//#include "Permalink.js


/**
 * Brief describtion:
 * 1. if there is href overlays, update the map accordingly (exception: layers not in flags range are kept as visible)
 * 2. once a layer is added, set eventhandlers for layer toggles
 * 3. on layer toggles, update overlayId href parameter with current state
 * 
 * Plugin Options:
 * 1. overlays: flattened overlays
 */
 L.Control.Permalink.include({

	initialize_overlay: function () {
		this.on('update', this._set_overlays, this);
		this.on('add', this._onadd_overlay, this);
	},

	// Sets eventhandlers for layer toggles
	_onadd_overlay: function () {
		this._map.on('layeradd', this._update_overlay, this);
		this._map.on('layerremove', this._update_overlay, this);
		this._update_overlay();
	},

	/**
	 * Updates overlayId href parameter with current overlay state 
	 * Called each time an overlay is added/removed
	 * @returns void
	 */
	_update_overlay: function (e) {
		if (!this._map._layers) return;
		let currentOverlays = this.currentOverlays();
		let changedOverlays = (
			e 
			&& (e.type === 'layeradd' || e.type === 'layerremove') 
			&& e.layer.hasOwnProperty('baselayer') 
			&& e.layer.hasOwnProperty('id')
			) ? 
				{[e.layer.id]: (e.type === 'layeradd')} 
				: {};
		if (currentOverlays) {
			this._update(this.minifyBooleanFlags({...currentOverlays, ...changedOverlays}));
		}
	},

	/**
	 * If map has layers, update it with the href overlay ids
	 * @param {object} e {params: [query params], sourceTarget, target, type}
	 * @returns void
	 */
	_set_overlays: function (e) {
		var p = e.params;
		if (!this._map._layers) return;
		this.setOverlays(p);
	},


	/**
	 * Updates map overlays according to the parsed href overlay ids parameters
	 * @param params The parsed href query parameters
	 * @returns void
	 */
	setOverlays: function (params) {
		let allLayers = this.options.overlays;
		let activeLayers = this.options.getActiveLayers();

		// returns undefined if layer was not found in URL, true if it was enabled in URL, otherwise false.
		let showLayer = (layerId) => params[layerId] ? String(params[layerId])[0] == "t" : undefined // values of params[layerId] might be "undefined", "true", or "false"
		
		// loop through active layers and disable ones that are disabled in the URL
		for (let layer of activeLayers) {
			if (showLayer(layer.id) !== undefined) {
				// if layer flag is on, and layer not yet actived, then toggle it on
				if (showLayer(layer.id) && !this._map.hasLayer(layer)) {
					this._map.addLayer(layer)
				}
				// if layer flag is off, and layer not already desactived, then toggle it off
				else if (!showLayer(layer.id) && this._map.hasLayer(layer)) {
					this._map.removeLayer(layer)
				}
			}
		}

		// loop through all layers and enable ones that are enabled in the URL
		for (let layer of allLayers) {
			if (showLayer(layer.id) !== undefined) {
				if (showLayer(layer.id)) {
					this._addLayer(layer)
				}

			}
		}
	},

	// Adds layer to the map layers; assumes layer has no children
	_addLayer: function(layer) {
		if (layer) {
			if (layer.layer !== undefined) {
				if (!this._map.hasLayer(layer.layer)) this._map.addLayer(layer.layer);
			}
			else if (!this._map.hasLayer(layer)) this._map.addLayer(layer)
		}
	},

	/**
	 * Updates href overlayId with current overlay state
	 * @returns {{[string]: [boolean]}} overlayId and its state
	 */
	currentOverlays: function () {
		let overlays = {};
		let activeLayers = this.options.getActiveLayers();
		for (let layer of activeLayers) {
			if (layer.baselayer) continue;
			if (!layer.baselayer) {
				overlays[layer.id] = this._map.hasLayer(layer);
			}
		}
		return overlays;
	},

	minifyBooleanFlags: (obj) => {
		for (let prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				let item = obj[prop];
				if (String(item) === "true") obj[prop] = "t"
				if (String(item) === "false") obj[prop] = "f"
			}
		}
		return obj;
	}
});