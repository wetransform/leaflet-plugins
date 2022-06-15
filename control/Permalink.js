L.Control.Permalink = L.Control.extend({
	includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

	options: {
		position: 'bottomleft',
		useAnchor: false,
		useLocation: false,
		useLocalStorage: false,
		text: 'Permalink',
		supportAngularHashRouting: false,
	},

	initialize: function (options) {
		L.Util.setOptions(this, options);
		this._params = {};
		this._set_urlvars();
		this.on('update', this._set_center, this);
		for (var i in this) {
			if (typeof(i) === 'string' && i.indexOf('initialize_') === 0)
				this[i]();
		}
	},

	onAdd: function (map) {
		this._container = L.DomUtil.create('div', 'leaflet-control-attribution leaflet-control-permalink');
		L.DomEvent.disableClickPropagation(this._container);
		this._map = map;

		// create anchor element pointing to this._href
		this._href = L.DomUtil.create('a', null, this._container);
		this._href.innerHTML = this.options.text;


		// Allow user to copy link here
		var _this = this;
		this._href.onclick = function(e) {
			e.preventDefault();
			prompt("Copy link to clipboard: Ctrl+C, then ENTER", _this._href.getAttribute('href'));
		}


		
		map.on('moveend', this._update_center, this);
		this.fire('update', {params: this._params});
		this._update_center();

		if (this.options.useAnchor && 'onhashchange' in window) {
			var _this = this, fn = window.onhashchange;
			window.onhashchange = function () {
				_this._set_urlvars();
				if (fn) return fn();
			};
		}

		this.fire('add', {map: map});

		return this._container;
	},

	// call this._update with the zoom and center coordinates values
	_update_center: function () {
		if (!this._map) return;

		var center = this._round_point(this._map.getCenter());
		this._update({zoom: String(this._map.getZoom()), lat: String(center.lat), lon: String(center.lng)});
	},

	_update_href: function () {
		// use leaflet.Util func to convert params object to string starting with query symbol (?)
		var params = L.Util.getParamString(this._params);
		var sep = '?';
		if (this.options.useAnchor) sep = '#';
		// remove default query symbol and insert the correct one: ? or #
		var url = this._url_base + sep + params.slice(1); 

		// set this._href to the computed url
		if (this._href) this._href.setAttribute('href', url);
		
		// info: the following was not taken into consideration when adapting the plugin to the angular hash routing
		if (this.options.useLocation)
			location.replace('#' + params.slice(1));
		if (this.options.useLocalStorage)
			window.localStorage.setItem('paramsTemp', params.slice(1));

		return url;
	},

	// util func
	_round_point : function (point) {
		var bounds = this._map.getBounds(), size = this._map.getSize();
		var ne = bounds.getNorthEast(), sw = bounds.getSouthWest();

		var round = function (x, p) {
			if (p === 0) return x;
			var shift = 1;
			while (p < 1 && p > -1) {
				x *= 10;
				p *= 10;
				shift *= 10;
			}
			return Math.floor(x)/shift;
		};
		point.lat = round(point.lat, (ne.lat - sw.lat) / size.y);
		point.lng = round(point.lng, (ne.lng - sw.lng) / size.x);
		return point;
	},

	// update this._params object and call this._update_href
	_update: function (obj) {
		for (var i in obj) {
			if (!obj.hasOwnProperty(i)) continue;
			if (obj[i] !== null && obj[i] !== undefined)
				this._params[i] = obj[i];
			else
				delete this._params[i];
		}

		this._update_href();
	},

	_set_urlvars: function ()
	{
		var p;
		
		// info: added Angular hashLocationStrategy support mainly in this if/else block
		if (this.options.useAnchor) {
			p = L.UrlUtil.queryParse(L.UrlUtil.hash(this.options));
			this._url_base = this.options.supportAngularHashRouting && L.UrlUtil.hashLocationStrategyUsed() ? L.UrlUtil.angularBaseUrl(true) : window.location.href.split('#')[0];
		} else {
			p = L.UrlUtil.queryParse(L.UrlUtil.query(this.options));
			this._url_base = this.options.supportAngularHashRouting && L.UrlUtil.hashLocationStrategyUsed() ? L.UrlUtil.angularBaseUrl(false) : window.location.href.split('#')[0].split('?')[0];
		}

		// info: the following was not taken into consideration when adapting the plugin to the angular hash routing
		if (this.options.useLocalStorage) {
			p = window.localStorage.getItem('paramsTemp');
			if (p !== null) {
				p = L.UrlUtil.queryParse(p);
			} else {
				p = {};
			}
		}
		
		// util func
		function eq (x, y) {
			for (var i in x)
				if (x.hasOwnProperty(i) && x[i] !== y[i])
					return false;
			return true;
		}
			
		// return if nothing changed
		if (eq(p, this._params) && eq(this._params, p))
			return;
		
		// update this._href since params changed
		this._params = p;
		this._update_href();
		this.fire('update', {params: this._params});
	},

	// set map view (UI) according to current params
	_set_center: function (e)
	{
		var params = e.params;
		if (params.zoom === undefined ||
		    params.lat === undefined ||
		    params.lon === undefined) return;
		this._map.setView(new L.LatLng(params.lat, params.lon), params.zoom);
	}
});

L.UrlUtil = {
	
	// converts query/hash strings into objects; example: p1=v1&p2=v2 becomes {p1: v1, ...}
	queryParse: function (s) {
		var p = {};
		var sep = '&';
		if (s.search('&amp;') !== -1)
			sep = '&amp;';
		var params = s.split(sep);
		for (var i = 0; i < params.length; i++) {
			var tmp = params[i].split('=');
			if (tmp.length !== 2) continue;
			try {
				p[tmp[0]] = decodeURIComponent(tmp[1]);
			} catch (e) {
				p[tmp[0]] = tmp[1];
			}
		}
		return p;
	},

	// return URL query part w/out the ? symbol
	query: function (options) {
		// intercept the func call to support Angular hashLocationStrategy here.
		if (options && options.supportAngularHashRouting) {
			if (this.hashLocationStrategyUsed()) return this.angularQuery();
		} 
		
		var href = window.location.href.split('#')[0], 
		idx = href.indexOf('?');
		
		if (idx < 0)
		return '';
		return href.slice(idx+1);
	},

	// return URL hash part w/out the # symbol
	hash: function (options) { 
		// intercept the func call to support Angular hashLocationStrategy here.
		if (options && options.supportAngularHashRouting) {
			if (this.hashLocationStrategyUsed()) return this.angularHash();
		}
		return window.location.hash.slice(1); 
	},

	// this function is not used in this file
	updateParamString: function (q, obj) {
		var p = L.UrlUtil.queryParse(q);
		for (var i in obj) {
			if (obj.hasOwnProperty(i))
				p[i] = obj[i];
		}
		return L.Util.getParamString(p).slice(1);
	},

	// input: hc.com/#/map?req=XYZ, output: req=XYZ 
	angularQuery: function() {
	
		let angularHref = window.location.href;
		let standardHref = angularHref.replace('#/', '');

		let hrefWithoutHash = standardHref.split('#')[0]; 

		let queryIndex = hrefWithoutHash.indexOf('?');

		return queryIndex < 0 ? "" : hrefWithoutHash.slice(queryIndex + 1); 

	},

	// input: hc.com/#/map#param=v1, output: param=v1
	angularHash: function() {
		let angularHref = window.location.href;
		let standardHref = angularHref.replace('#/', '');

		return standardHref.split('#')[1] || ""; 
	},

	// remove the query and hash parts, and return base url
	angularBaseUrl: function(useAnchor) {
		let firstSplit = window.location.href.split("/#/");
		return [firstSplit[0], firstSplit[1].split('#')[0].split(useAnchor ? null : '?')[0]].join('/#/');
	},

	// detect if URL contains /#/, thus angular hash routing
	hashLocationStrategyUsed: function() {
		return window.location.href.indexOf('/#/') > -1;
	},
};
