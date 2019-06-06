// Bing maps API: https://docs.microsoft.com/en-us/bingmaps/rest-services/

L.BingLayer = L.TileLayer.extend({
	options: {
		// imagerySet: https://docs.microsoft.com/en-us/bingmaps/rest-services/imagery/get-imagery-metadata#template-parameters
		// supported:
		// - Aerial, AerialWithLabels (Deprecated), AerialWithLabelsOnDemand
		// - Road (Deprecated), RoadOnDemand
		// - CanvasDark, CanvasLight, CanvasGray
		// not supported: Birdseye*, Streetside
		type: 'RoadOnDemand',

		// https://docs.microsoft.com/en-us/bingmaps/rest-services/common-parameters-and-types/supported-culture-codes
		culture: '',

		// https://docs.microsoft.com/en-us/bingmaps/articles/custom-map-styles-in-bing-maps#custom-map-styles-in-the-rest-and-tile-services
		style: '',

		// https://blogs.bing.com/maps/2015/02/12/high-ppi-maps-now-available-in-the-bing-maps-ajax-control
		// not documented in REST API docs, but working
		// warning: deprecated imagery sets may not support some values (depending also on zoom level)
		retinaDpi: 'd2',

		attribution: 'Bing',
		minZoom: 1,
		maxZoom: 21
		// Actual `maxZoom` value may be less, depending on imagery set / coverage area
		// - 19~20 for all 'Aerial*'
		// - 20 for 'Road' (Deprecated)
	},

	initialize: function (key, options) {
		if (typeof key === 'object') {
			options = key;
			key = false;
		}
		L.TileLayer.prototype.initialize.call(this, null, options);

		if (key) { this.options.key = key; }
	},

	tile2quad: function (x, y, z) {
		var quad = '';
		for (var i = z; i > 0; i--) {
			var digit = 0;
			var mask = 1 << i - 1;
			if ((x & mask) !== 0) { digit += 1; }
			if ((y & mask) !== 0) { digit += 2; }
			quad = quad + digit;
		}
		return quad;
	},

	getTileUrl: function (coords) {
		var data = {
			subdomain: this._getSubdomain(coords),
			quadkey: this.tile2quad(coords.x, coords.y, this._getZoomForUrl()),
			culture: this.options.culture // compatibility for deprecated imagery sets ('Road' etc)
		};
		return L.Util.template(this._url, data);
	},


	callRestService: function (request, callback, context) {
		context = context || this;
		var uniqueName = '_bing_metadata_' + L.Util.stamp(this);
		while (window[uniqueName]) { uniqueName += '_'; }
		request += '&jsonp=' + uniqueName;
		var script = document.createElement('script');
		script.setAttribute('type', 'text/javascript');
		script.setAttribute('src', request);
		window[uniqueName] = function (response) {
			delete window[uniqueName];
			script.remove();
			if (response.errorDetails) {
				throw new Error(response.errorDetails);
			}
			callback.call(context, response);
		};
		document.body.appendChild(script);
	},

	loadMetadata: function () {
		if (this.metaRequested) { return; }
		this.metaRequested = true;
		var urlScheme = document.location.protocol === 'file:' ? 'http' :
			document.location.protocol.slice(0, -1);
		var url = urlScheme + '://dev.virtualearth.net/REST/v1/Imagery/Metadata/' + this.options.type;
		url += L.Util.getParamString({
			UriScheme: urlScheme,
			include: 'ImageryProviders',
			key: this.options.key,
			culture: this.options.culture,
			style: this.options.style
		});
		this.callRestService(url, this.initMetadata);
	},

	initMetadata: function (meta) {
		var options = this.options;
		var r = meta.resourceSets[0].resources[0];
		if (!r.imageUrl) { throw new Error('imageUrl not found in response'); }
		if (r.imageUrlSubdomains) { options.subdomains = r.imageUrlSubdomains; }
		this._url = r.imageUrl;
		this._providers = [];
		if (r.imageryProviders) {
			for (var i = 0; i < r.imageryProviders.length; i++) {
				var p = r.imageryProviders[i];
				for (var j = 0; j < p.coverageAreas.length; j++) {
					var c = p.coverageAreas[j];
					var coverage = {zoomMin: c.zoomMin, zoomMax: c.zoomMax, active: false};
					var bounds = L.latLngBounds(
							[c.bbox[0]+0.01, c.bbox[1]+0.01],
							[c.bbox[2]-0.01, c.bbox[3]-0.01]
					);
					coverage.bounds = bounds;
					coverage.attrib = p.attribution;
					this._providers.push(coverage);
				}
			}
		}
		if (options.retinaDpi && options.detectRetina && options.zoomOffset) {
			this._url += '&dpi=' + options.retinaDpi;
		}
		this._update();
	},

	_update: function (center) {
		if (!this._url || !this._map) { return; }
		this._update_attribution();
		L.GridLayer.prototype._update.call(this, center);
	},

	_update_attribution: function () {
		var bounds = this._map.getBounds();
		bounds = L.latLngBounds(bounds.getSouthWest().wrap(), bounds.getNorthEast().wrap());
		var zoom = this._getZoomForUrl();
		for (var i = 0; i < this._providers.length; i++) {
			var p = this._providers[i];
			if ((zoom <= p.zoomMax && zoom >= p.zoomMin) &&
					bounds.intersects(p.bounds)) {
				if (!p.active && this._map.attributionControl)
					this._map.attributionControl.addAttribution(p.attrib);
				p.active = true;
			} else {
				if (p.active && this._map.attributionControl)
					this._map.attributionControl.removeAttribution(p.attrib);
				p.active = false;
			}
		}
	},

	onAdd: function (map) {
		// Note: Metadata could be loaded earlier, on layer initialize,
		//       but according to docs even such request is billable:
		//       https://docs.microsoft.com/en-us/bingmaps/getting-started/bing-maps-dev-center-help/understanding-bing-maps-transactions#rest-services
		//       That's why it's important to defer it till BingLayer is actually added to map
		this.loadMetadata();
		L.GridLayer.prototype.onAdd.call(this, map);
	},

	onRemove: function (map) {
		for (var i = 0; i < this._providers.length; i++) {
			var p = this._providers[i];
			if (p.active && this._map.attributionControl) {
				this._map.attributionControl.removeAttribution(p.attrib);
				p.active = false;
			}
		}
		L.GridLayer.prototype.onRemove.call(this, map);
	}
});

L.bingLayer = function (key, options) {
	return new L.BingLayer(key, options);
};
