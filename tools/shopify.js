
// Initialize NPM libraries
var async = require('async');
var Shopify = require('shopify-api-node');
var moment = require('moment');

// Initialize tools
var tools = './../tools/'
var FTP = require(tools+'ftp');
var Files = require(tools+'files');

// Initialize config
var config = require('./../config');

// Functions ===================================================================

// Setup Shopify: makes a Shopify API client using config settings
function setupShopify (next) {
	console.log('Setting up Shopify client...');
	next(null, new Shopify({
		shopName: config.shopifyShopName,
		apiKey: config.shopifyAPIKey,
		password: config.shopifyPassword
	}));
};

// Getters
function getProducts({params}, next) {
	console.log('Getting all products...');

	// Setup params
	if (!params) params = {};

	// Setup default params
	if (!params.limit) params.limit = 10;

	// Initialize output
	var output = new Array();

	// Waterfall
	async.waterfall([

		// Setup Shopify if neccesary
		function (callback) {
			setupShopify(function (err, client) {
				callback(err, client);
			});
		},

		// Get count of products
		function (client, callback) {

			// Setup count params
			var countParams = JSON.parse(JSON.stringify(params));
			delete countParams.limit;
			delete countParams.fields;

			// Get count
			client.product.count(countParams)
				.then(function (productCount) {
					callback(null, client, productCount);
				})
				.catch(function (err) {
					callback(err);
				})
		},

		// Make exhaustive product queries based on count
		function (client, productCount, callback) {

			// Initialize count
			var count = 0;

			// Exhaust products based on count
			async.whilst(function () {
				return count < productCount;
			}, function (callback) {

				// Setup list params
				params.page = Math.floor(count/params.limit)+1;

				// List objects
				client.product.list(params)
				.then(function (products) {
					for (var i in products) {
						output.push(products[i]);
						count++;
					}
					console.log(count+'/'+productCount+' products downloaded...');
					callback();
				})
				.catch(function (err) {
					callback(err);
				})
			}, function (err) {
				callback(err)
			})
		}
	], function (err) {
		next(err, output);
	})
}

function getOrders({params}, next) {
	console.log('Getting orders...');

	// Setup params
	if (!params) params = {};

	// Setup default params
	if (!params.limit) params.limit = 10;

	// Initialize output array
	var output = new Array();

	// Waterfall
	async.waterfall([

		// Setup Shopify if neccesary
		function (callback) {
			setupShopify(function (err, client) {
				callback(err, client);
			});
		},

		// Get count of orders
		function (client, callback) {

			// Setup count params
			var countParams = JSON.parse(JSON.stringify(params));
			delete countParams.limit;
			delete countParams.fields;

			// Get count
			client.order.count(countParams)
			.then(function (orderCount) {
				callback(null, client, orderCount);
			})
			.catch(function (err) {
				callback(err);
			})
		},

		// Make exhaustive order queries based on count
		function (client, orderCount, callback) {

			// Initialize count
			var count = 0;

			// Exhaust products based on count
			async.whilst(function () {
				return count < orderCount;
			}, function (callback) {

				// Setup list params
				params.page = Math.floor(count/params.limit)+1;

				// Make request
				client.order.list(params)
				.then(function (orders) {
					for (var i in orders) {
						output.push(orders[i]);
						count++;
					}
					console.log(count+'/'+orderCount+' orders downloaded...');
					callback();
				})
				.catch(function (err) {
					callback(err);
				})
			}, function (err) {
				callback(err)
			})
		}
	], function (err) {
		next(err, output);
	})
}

function getVariant ({client, id}, next) {
	console.log('Getting Shopify variant...');
	client.productVariant.get(id)
		.then(function (variant) {
			next(null, variant);
		})
		.catch(function (err) {
			next(err);
		});
};

function setVariant({client, update}, next) {
	console.log('Updating Shopify variant...');
	client.productVariant.update(update.id, update.params)
		.then(function (response) {
			next(null);
		})
		.catch(function (err) {
			next(err);
		})
};

function getOrder ({client, id}, next) {
	console.log('Getting Shopify order...');
	client.order.get(id)
		.then(function (order) {
			next(null, order);
		})
		.catch(function (err) {
			next(err);
		});
};

function makeFulfillment({client, update}, next) {
	console.log('Making Shopify fulfillment...');
	client.fulfillment.create(update.id, update.params)
		.then(function (response) {
			next(null);
		})
		.catch(function (err) {
			next(err);
		})
};

function handleInventoryFile ({file, map}, next) {
	console.log('Handling inventory file...');

	// Initialize rows
	var rows = file.data;

	async.waterfall([

		// Setup Shopify client
		function (callback) {
			setupShopify(function (err, shopify) {
				callback(err, shopify);
			});
		},

		// Get variant from Shopify for each row in file, make updates array
		function (shopify, callback) {
			var updates = new Array();
			async.each(rows, function (row, callback) {

				// Initialize fields from row
				var upc = row['(C)upc'];
				var quantity = row['(E)quantity'];
				var price = row['(F)MiscFlag'];

				// Get variant from map
				var mapVariant = map[upc];

				// If variant is found in map...
				if (mapVariant) {

					// Get variant from Shopify
					getVariant({
						'client': shopify,
						'id': mapVariant.id,
					}, function (err, variant) {

						// If variant is found on Shopify, push information into updates array
						if (variant) {

							// Create update config
							var update = {
								'id': variant.id,
								'upc': upc,
								'params': {
									'old_inventory_quantity': variant.inventory_quantity,
									'inventory_quantity': quantity,
									'price': price,
								},
							};

							// Push into updates array
							updates.push(update);
						}

						// Callback to advance array
						callback(err);
					})
				} else {

					console.log(upc+' not found in inventory');

					// Callback to advance array
					callback();
				}

			}, function (err) {
				callback(err, shopify, updates);
			});
		},

		// Make updates on Shopify
		function (shopify, updates, callback) {
			async.each(updates, function (update, callback) {
				setVariant({
					'client': shopify,
					'update': update,
				}, function (err) {
					if (!err) console.log(update.upc+' updated successfully!');
					callback(err);
				});
			}, function (err) {
				callback(err);
			})
		},

		// Setup FTP server
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Delete file from server
		function (ftp, callback) {
			FTP.delete({
				'client': ftp,
				'path': file.path
			}, function (err) {
				callback(err);
			});
		},

	], function (err) {
		next(err);
	})
};

function handleShipmentFile ({file, productsMap, ordersMap}, next) {
	console.log('Handling shipment file...');

	// Initialize rows
	var rows = file.data;

	async.waterfall([

		// Setup Shopify client
		function (callback) {
			setupShopify(function (err, shopify) {
				callback(err, shopify);
			});
		},

		// Get variant from Shopify for each row in file, make updates array
		function (shopify, callback) {

			// Initialize updates array
			var updates = new Array();

			// Group rows into shipments
			var shipments = {};
			for (var i in rows) {
				var tracking = rows[i]['Tracking #'];
				if (!shipments[tracking]) shipments[tracking] = [];
				shipments[tracking].push(rows[i]);
			}
			var shipmentsArray = [];
			for (var key in shipments) shipmentsArray.push(shipments[key]);

			// Find an order for each shimpment
			async.each(shipmentsArray, function (shipment, callback) {

				// Initialize fields from first shimpent
				var orderName = shipment[0]['PO #'];
				var tracking = shipment[0]['Tracking #'];
				var method = shipment[0]['Method'];

				// Get variant IDs for each shipment
				var fulfillmentItems = [];
				for (var i in shipment) {
					var item = shipment[i];
					var sku = item['SKU'];
					var quantity = parseInt(item['Quantity'], 10);
					var mapProduct = productsMap[sku];
					if (mapProduct) fulfillmentItems.push({
						'id': mapProduct.id,
						'quantity': quantity,
					});
					else console.log(sku+' not found in inventory');
				}

				// Get order from ordersMap
				var mapOrder = ordersMap[orderName];

				// If variant is found in map...
				if (mapOrder) {

					// Get variant from Shopify
					getOrder({
						'client': shopify,
						'id': mapOrder.id,
					}, function (err, order) {

						// If order is found on Shopify, push information into updates array
						if (order) {

							// Create update config
							var update = {
								'id': mapOrder.id,
								'orderName': orderName,
								'params': {
									'fulfillment': {
										'tracking_number': tracking,
										'tracking_compmany': method,
										'line_items': fulfillmentItems,
									},
								},
							};

							// Push into updates array
							updates.push(update);
						}

						// Callback to advance array
						callback(err);
					})
				} else {
					console.log(orderName+' not found in orders');

					// Callback to advance array
					callback();
				}

			}, function (err) {
				callback(err, shopify, updates);
			});
		},

		// Make updates on Shopify
		function (shopify, updates, callback) {
			async.each(updates, function (update, callback) {
				makeFulfillment({
					'client': shopify,
					'update': update,
				}, function (err) {
					if (!err) console.log(update.orderName+' updated successfully!');
					callback(err);
				});
			}, function (err) {
				callback(err);
			})
		},

		// Setup FTP server
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Delete file from server
		function (ftp, callback) {
			FTP.delete({
				'client': ftp,
				'path': file.path
			}, function (err) {
				callback(err);
			});
			callback();
		},

	], function (err) {
		next(err);
	})
};

function makeProductsMap (next) {
	console.log('Making products map...');

	async.waterfall([

		// Get all products from Shopify
		function (callback) {
			getProducts({
				'params': {
					'fields': "id,variants",
				},
			}, function (err, products) {
				callback(err, products);
			})
		},

		// Create map of products
		function (products, callback) {
			var map = {};
			for (var i in products) {
				for (var j in products[i].variants) {
					map[products[i].variants[j].sku] = {
						'id': products[i].variants[j].id,
						'quantity': products[i].variants[j].inventory_quantity
					};
				}
			}
			callback(null, map);
		},

	], function (err, map) {
		next(err, map);
	})
};

function makeOrdersMap (next) {
	console.log('Making orders map...');

	async.waterfall([

		// Get all products from Shopify
		function (callback) {
			getOrders({
				'params': {
					'fields': "id,name",
				},
			}, function (err, orders) {
				callback(err, orders);
			})
		},

		// Create map of orders
		function (orders, callback) {
			var map = {};
			for (var i in orders) {
				map[orders[i].name] = {
					'id': orders[i].id
				};
			}
			callback(null, map);
		},

	], function (err, map) {
		next(err, map);
	})
};

// Exports =====================================================================
module.exports = {
	setup: function (next) {
		setupShopify(next)
	},
	getProducts: function ({params}, next) {
		getProducts({params}, next)
	},
	getOrders: function ({params}, next) {
		getOrders({params}, next)
	},
	getVariant: function ({client, id}, next) {
		getVariant({client, id}, next)
	},
	setVariant: function ({client, update}, next) {
		setVariant({client, update}, next)
	},
	handleInventoryFile: function ({file, map}, next) {
		handleInventoryFile({file, map}, next)
	},
	handleShipmentFile: function ({file, productsMap, ordersMap}, next) {
		handleShipmentFile({file, productsMap, ordersMap}, next)
	},
	makeProductsMap: function (next) {
		makeProductsMap(next)
	},
	makeOrdersMap: function (next) {
		makeOrdersMap(next)
	},
}
