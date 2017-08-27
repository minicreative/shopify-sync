
// Initialize NPM libraries
var FTP = require('ftp');

// Initialize tools
var tools = './../tools/';
var Log = require(tools+'log');

// Initialize config
var config = require('./../config');

// Functions ===================================================================

// Setup FTP: makes an FTP client using config settings
function setupFTP (next) {
	console.log('Setting up FTP client at '+config.ftpHost+'...');

	// Initialize ftpClient
	var ftp = new FTP();

	// Setup listeners
	ftp
		.on('ready', function () {
			next(null, ftp);
		})
		.on('error', function (error) {
			next(error);
		});

	// Start connection
	ftp.connect({
		host: config.ftpHost,
		user: config.ftpUsername,
		password: config.ftpPassword
	});
};

// List FTP Files: lists ftp files in directory
function listFTPFiles ({client, path}, next) {
	console.log('Getting list of files from '+path+'...');
	client.list(path, function (err, list) {
		next(err, list);
	});
};

// Get FTP File: gets an FTP file using a path
function getFTPFile({client, path}, next) {
	console.log('Getting '+path+'...');
	client.get(path, function (err, file) {
		next(err, file);
	});
};

// Delete FTP File: deletes an FTP file using a path
function deleteFTPFile({client, path}, next) {
	console.log('Deleting '+path+'...');
	client.delete(path, function (err) {
		next(err);
	});
};

// Write FTP File: writes a file to an FTP
function writeFTPFile({client, path, file}, next) {
	console.log('Writing '+path+'...');
	client.put(file, path, function (err) {
		next(err);
	});
}

// Exports =====================================================================
module.exports = {
	setup: function (next) {
		setupFTP(next)
	},
	get: function ({client, path}, next) {
		getFTPFile({client, path}, next)
	},
	write: function ({client, path, file}, next) {
		writeFTPFile({client, path, file}, next)
	},
	delete: function ({client, path}, next) {
		deleteFTPFile({client, path}, next)
	},
	list: function ({client, path}, next) {
		listFTPFiles({client, path}, next)
	},
}
