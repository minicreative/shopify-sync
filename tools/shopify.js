
// Initialize NPM libraries
var async = require('async');
var Shopify = require('shopify-api-node');

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
function getAllProducts({client, fields, pageSize}, next) {
	console.log('Getting all products...');

	// Initialize pageSize & output array
	if (!pageSize) pageSize = 20;
	if (!fields) fields = "id";
	var output = new Array();

	// Waterfall
	async.waterfall([

		// Get count of products
		function (callback) {
			client.product.count()
				.then(function (productCount) {
					callback(null, productCount);
				})
				.catch(function (err) {
					callback(err);
				})
		},

		// Make exhaustive product queries based on count
		function (productCount, callback) {

			// Initialize count
			var count = 0;

			// Exhaust products based on count
			async.whilst(function () {
				return count < productCount;
			}, function (callback) {
				client.product.list({
					'fields': fields,
					'limit': pageSize,
					'page': Math.floor(count/pageSize)+1
				})
				.then(function (products) {
					for (var i in products) {
						output.push(products[i]);
						count++;
					}
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
}

// Exports =====================================================================
module.exports = {
	setup: function (next) {
		setupShopify(next)
	},
	getAllProducts: function ({client, fields, pageSize}, next) {
		getAllProducts({client, fields, pageSize}, next)
	},
	getVariant: function ({client, id}, next) {
		getVariant({client, id}, next)
	},
	setVariant: function ({client, update}, next) {
		setVariant({client, update}, next);
	},
}
