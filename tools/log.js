
// Initialize message array
var messages = new Array();

// Export
module.exports = {

	// Log: prints console.log but also saves string in messages
	log: function (string) {
		console.log(string);
		messages.push(string);
	},

	// Get Logs: returns messages array
	getLogs: function () {
		return messages;
	},

	// Reset: empties messages array
	reset: function () {
		messages = new Array();
	},
};