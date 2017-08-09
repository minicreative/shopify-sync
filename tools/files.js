
// Initialize NPM libraries
var Parse = require('babyparse');
var async = require('async');

// Initialize tools
var tools = './../tools/'
var Shopify = require(tools+'shopify');
var FTP = require(tools+'ftp');

// Functions ===================================================================

// Handle Inventory File
function handleInventoryFile (file, next) {
	console.log('Handling inventory file...');

};

// Get Parsed CSVs from Directory: returns a formatted list of CSV files from an FTP directory
function getParsedCSVsFromDirectory (directory, next) {
	console.log('Getting parsed files from directory...');

	var output = new Array();

	async.waterfall([

		// Setup FTP client
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Get list of files
		function (ftp, callback) {
			FTP.list({
				'client': ftp,
				'directory': directory,
			}, function (err, list) {
				callback(err, ftp, list);
			})
		},

		// Iterate through list of files
		function (ftp, list, callback) {

			// Initialize output array
			var output = new Array();

			// For each item in list...
			async.each(list, function (item, callback) {

				// Skip over non .csv files without error
				if (!fileIsCSV(item)) return callback();

				// Setup FTP request
				var ftpRequest = {
					'client': ftp,
					'path': directory+item.name,
				};

				// Get FTP file as stream, then...
				FTP.get(ftpRequest, function (err, stream) {
					if (err) return callback(err);

					// Parse stream, then...
					parseStream(stream, function (err, data) {
						if (err) return callback(err);

						// Format file and add to output
						output.push({
							'path': directory+item.name,
							'data': data
						});
						callback();
					});

				});

			}, function (err) {
				callback(err, output);
			});
		},

	], function (err, output) {
		next(err, output);
	})
};

// Parse Stream: parses ReadableStream file into JSON
function parseStream (stream, next) {
	console.log('Parsing file...');

	// Initialize string
	var string = '';

	// Convert stream to string
	stream.on('data', chunk => string += chunk);

	// When finished, parse string
	stream.on('end', function () {
		Parse.parse(string, {
			header: true,
			error: function (err) {
				next(err);
			},
			complete: function (results) {
				next(null, results.data);
			},
		});
	});
};

// File Is CSV: checks if file is a CSV file
function fileIsCSV(file) {
	if (file.type != '-') return false;
	if (file.name.substring(file.name.length - 4) != '.csv') return false;
	return true;
};

// Exports =====================================================================
module.exports = {
	'getFromDirectory': function (directory, next) {getParsedCSVsFromDirectory(directory, next)},
	'handleInventory': function (file, next) {handleInventoryFile(file, next)},
};
