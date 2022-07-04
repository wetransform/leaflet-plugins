//#include "Permalink.js


/**
 * Brief describtion:
 * 1. if there is href baselayer, update the map to use it
 * 2. once a layer is added, set eventhandlers for layer toggles
 * 3. on layer toggles, update href parameter with current baselayer
 */
 L.Control.Permalink.include({
	/*
	options: {
		useMarker: true,
		markerOptions: {}
	},
	*/

	initialize_layer: function () {
		this.on('update', this._set_layer, this);
		this.on('add', this._onadd_layer, this);
	},

	// Sets eventhandlers for layer toggles
	_onadd_layer: function (e) {
		this._map.on('layeradd', this._update_layer, this);
		this._map.on('layerremove', this._update_layer, this);
		this._update_layer();
	},

	/**
	 * Updates href baselayer parameter with active baselayer.id
	 * Called each time a baselayer is added/removed
	 * @returns void
	 */
	_update_layer: function () {
		if (!this._map._layers) return;

		let baselayer = this.currentBaseLayer();
		if (baselayer) {
			this._update({baselayer: baselayer.id});
		}
	},

	/**
	 * If map has layers, update it with the href layer
	 * @param {object} e {params: [query params], sourceTarget, target, type}
	 * @returns void
	 */
	_set_layer: function (e) {
		// e {params: request, etc., sourceTarget, target, type: update}
		var p = e.params;
		if (!this._map._layers || !p.baselayer) return;
		this.chooseBaseLayer(p.baselayer);
	},

	/**
	 * Updates map baselayer according to the parsed href parameter: baselayerId
	 * @param {string} baselayerId The parsed href baselayer parameter
	 * @returns void
	 */
	chooseBaseLayer: function (baselayerId) {
		let baselayer;
		let layers = Object.values(this._map._layers);

		// search for the matching baselayer of the map layers
		for (let layer of layers) {
			if (layer.baselayer && layer.id === baselayerId) {
				baselayer = layer;
				break;
			}
		}

		// baselayer already selected or does not exist. Nothing to update!
		if (this._map.hasLayer(baselayer)) {
			return;
		}

		if (!baselayer) {
			return;
		}


		// update map baselayer and remove current one
		for (let layer of layers) {
			if (layer.baselayer && this._map.hasLayer(layer)) {
				this._map.removeLayer(layer);
			}
		}

		this._map.addLayer(baselayer);
		this._update();
	},

	/**
	 * Searches the map layers for the currently activated baselayer
	 * @returns currentBaselayer
	 */
	currentBaseLayer: function () {
		for (let layer of Object.values(this._map._layers)) {
			if (layer.baselayer && this._map.hasLayer(layer)) return layer;
		}

		return null;
	}
});