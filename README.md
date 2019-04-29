# shopify-sync
Parses CSV files to update a Shopify inventory using the Shopify API

## Setup
To run this script, you'll need to create a configuration file in the top level directory called `config.js`:
```
module.exports = {

	// Debugging (set to true if actively debugging)
	'debug': false,

	// Schedule
	'schedule': "<SCHEDULE CRON STRING GOES HERE>",

	// Shopify Store Information
	'shopifyShopName': "<SHOPIFY ACCOUNT NAME GOES HERE>",
	'shopifyAPIKey': "<SHOPIFY API KEY GOES HERE>",
	'shopifyPassword': "<SHOPIFY PASSWORD GOES HERE>",

	// FTP Server Information
	'ftpHost': "<FTP SERVER URL GOES HERE>",
	'ftpUsername': "<FTP USERNAME GOES HERE>",
	'ftpPassword': "<FTP PASSWORD GOES HERE>",

	// Directories (should end in '/')
	'directories': {
		'inventory': "<INVENTORY DIRECTORY PATH GOES HERE>",
		'orders': "<ORDERS DIRECTORY PATH GOES HERE>",
		'shipments': "<SHIPMENTS DIRECTORY PATH GOES HERE>",
		'timestamps': "<TIMESTAMPS DIRECTORY PATH GOES HERE>",
	},

	// Email Logs
	'sendgridAPIKey': "<SENDGRID API KEY GOES HERE>",
	'logEmail': null,

	// Sentry Bug Tracker
	'sentryAPIKey': "<SENTRY URL GOES HERE>"
};
```
