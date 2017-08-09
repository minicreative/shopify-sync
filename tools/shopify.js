
// Initialize NPM libraries
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

// Exports =====================================================================
module.exports = {
	setup: function (next) {setupShopify(next)},
}
