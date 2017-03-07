/*
 * Copyright © 2017 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

var LiskJS = {};
LiskJS.crypto = require('../transactions/crypto');
var parseOfflineRequest = require('./parseTransaction');

function LiskAPI (options) {
	if (!(this instanceof LiskAPI)) {
		return new LiskAPI(options);
	}

	options = options || {};

	this.defaultPeers = [
		'node01.lisk.io',
		'node02.lisk.io',
		'node03.lisk.io',
		'node04.lisk.io',
		'node05.lisk.io',
		'node06.lisk.io',
		'node07.lisk.io',
		'node08.lisk.io'
	];

	this.defaultSSLPeers = [
		'login.lisk.io'
	];

	this.defaultTestnetPeers = [
		'83.136.249.129'
	];

	this.options = options;
	this.ssl = options.ssl || false;
	this.testnet = options.testnet || false;
	this.autoFindNode = options.autoFindNode || true;
	this.bannedNodes = [];
	this.currentNode = options.node || this.selectNode();
	if (options.port === '' || options.port) this.port = options.port;
	else                                    this.port = 8000;
	this.parseOfflineRequests = parseOfflineRequest;
	this.nethash = this.getNethash();
}

LiskAPI.prototype.getNethash = function () {
	var NetHash;

	if (this.testnet) {
		NetHash = {
			'Content-Type': 'application/json',
			'nethash': 'da3ed6a45429278bac2666961289ca17ad86595d33b31037615d4b8e8f158bba',
			'broadhash': 'da3ed6a45429278bac2666961289ca17ad86595d33b31037615d4b8e8f158bba',
			'os': 'lisk-js-api',
			'version': '1.0.0',
			'minVersion': '>=0.5.0',
			'port': this.port
		};
	} else {
		NetHash = {
			'Content-Type': 'application/json',
			'nethash': 'ed14889723f24ecc54871d058d98ce91ff2f973192075c0155ba2b7b70ad2511',
			'broadhash': 'ed14889723f24ecc54871d058d98ce91ff2f973192075c0155ba2b7b70ad2511',
			'os': 'lisk-js-api',
			'version': '1.0.0',
			'minVersion': '>=0.5.0',
			'port': this.port
		};
	}

	return NetHash;
};

LiskAPI.prototype.setNode = function (node) {
	this.currentNode = node || this.selectNode();
	return this.currentNode;
};

LiskAPI.prototype.setTestnet = function (testnet) {
	if (this.testnet !== testnet) {
		this.testnet = testnet;
		this.selectNode();
	}
};

LiskAPI.prototype.setSSL = function (ssl) {
	if (this.ssl !== ssl) {
		this.ssl = ssl;
		this.selectNode();
	}
};

LiskAPI.prototype.getFullUrl = function () {
	var nodeUrl = this.currentNode;

	if (this.port) {
		nodeUrl += ':'+this.port;
	}

	return this.getURLPrefix() + '://' + nodeUrl;
};

LiskAPI.prototype.getURLPrefix = function () {
	if (this.ssl) {
		return 'https';
	} else {
		return 'http';
	}
};

LiskAPI.prototype.selectNode = function () {
	var currentRandomPeer;

	if (this.options.node) {
		currentRandomPeer = this.currentNode;
	}

	if (this.autoFindNode) {
		currentRandomPeer = this.getRandomPeer();
		var peers = (this.ssl) ? this.defaultSSLPeers : this.defaultPeers;
		if (this.testnet) peers = this.defaultTestnetPeers;

		for (var x = 0; x< peers.length; x++) {
			if (this.bannedNodes.indexOf(currentRandomPeer) === -1) break;
			currentRandomPeer = this.getRandomPeer();
		}
	}

	return currentRandomPeer;
};

LiskAPI.prototype.getRandomPeer = function () {
	var peers = (this.ssl) ? this.defaultSSLPeers : this.defaultPeers;
	if (this.testnet) peers = this.defaultTestnetPeers;

	var getRandomNumberForPeer = Math.floor((Math.random() * peers.length));
	return peers[getRandomNumberForPeer];
};

LiskAPI.prototype.banNode = function () {
	if (this.bannedNodes.indexOf(this.currentNode) === -1) this.bannedNodes.push(this.currentNode);
	this.selectNode();
};

LiskAPI.prototype.sendRequest = function (requestType, options, callback) {
	callback = callback || options;
	options = typeof options !== 'function' && typeof options !== 'undefined' ? options : {};
	var toolBox = this;

	this.sendRequestPromise(requestType, options).then(function (requestSuccess) {
		var JSONAnswer = JSON.parse(requestSuccess);
		var checkRequestContent = parseOfflineRequest(requestType, options);

		// Show offline Request if it is POST or PUT request
		if (checkRequestContent.requestMethod === 'GET') {
			return callback(JSON.parse(requestSuccess));
		} else {
			var interpretAnswer = checkRequestContent.transactionOutputAfter(JSONAnswer);
			return callback(interpretAnswer);
		}
	}, function () {
		setTimeout(function () {
			toolBox.banNode();
			toolBox.setNode();
			toolBox.sendRequest(requestType, options, callback);
		}, 1000);
	});
};

LiskAPI.prototype.sendRequestPromise = function (requestType, options) {
	var that = this;

	return new Promise(function (resolve, reject) {
		var xhttp = new XMLHttpRequest();

		xhttp.onreadystatechange = function () {
			if (this.readyState === 4 && this.status === 200) {
				resolve(this.responseText);
			} else {
				// this.status === 500 - internal server error - description: Wrong API call
				if ((this.status === 404 || this.status === 503 || this.status === 0) && this.readyState === 4) {
					reject({
						msg: 'Could not load xhttp request',
						error: this.status
					});
				}
			}
		};

		var InitRequest = parseOfflineRequest(requestType, options);
		var requestMethod = InitRequest.requestMethod;
		var requestUrl;
		var sendParams = '';

		// Send GET request by xhttp
		if (requestMethod === 'GET') {
			requestUrl = that.getFullUrl()  + '/api/'+ requestType;

			if (Object.keys(options).length > 0) {
				requestUrl = requestUrl + that.serialiseHttpData(options);
			}

			xhttp.open(requestMethod, requestUrl , true);
			xhttp.send();
			// Do not use xhttp to send
		} else if (requestMethod === 'NOACTION') {
			resolve(JSON.stringify({ done: 'done'}));
			// Send POST or PUT requets with xhttp
		} else {
			var getNewRequest = InitRequest.checkOfflineRequestBefore(requestType, options);

			if (getNewRequest.requestUrl === 'transactions') {
				requestUrl = that.getFullUrl()  + '/peer/'+ getNewRequest.requestUrl;
				// console.log(requestUpdate());
				xhttp.open('POST', requestUrl, true);

				var Nethash = that.nethash;

				for (var key in Nethash) {
					if (Nethash.hasOwnProperty(key)) {
						xhttp.setRequestHeader(key, Nethash[key]);
					}
				}

				sendParams = getNewRequest.params;
			} else {
				requestUrl = that.getFullUrl()  + '/api/'+ getNewRequest.requestUrl;
				xhttp.open(getNewRequest.requestMethod, requestUrl, true);
			}

			xhttp.send(JSON.stringify(sendParams));
		}
	});
};

LiskAPI.prototype.serialiseHttpData = function (data, type) {
	var serialised;

	if (type === 'GET') {
		if (typeof data === 'string') {
			data += '&random=' + Math.random();
		} else {
			data.random = Math.random();
		}
	}

	serialised = this.trimObj(data);
	serialised = this.toQueryString(serialised);
	serialised = encodeURI(serialised);

	return '?'+serialised;
};

LiskAPI.prototype.trimObj = function (obj) {
	if (!Array.isArray(obj) && typeof obj !== 'object') return obj;

	return Object.keys(obj).reduce(function (acc, key) {
		acc[key.trim()] = typeof obj[key] === 'string'? obj[key].trim() : this.trimObj(obj[key]);
		return acc;
	}, Array.isArray(obj)? []:{});
};

LiskAPI.prototype.toQueryString = function (obj) {
	var parts = [];

	for (var i in obj) {
		if (obj.hasOwnProperty(i)) {
			parts.push(encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]));
		}
	}

	return parts.join('&');
};

LiskAPI.prototype.getAddressFromSecret = function (secret) {
	var accountKeys = LiskJS.crypto.getKeys(secret);
	var accountAddress = LiskJS.crypto.getAddress(accountKeys.publicKey);

	return {
		address: accountAddress,
		publicKey: accountKeys.publicKey
	};
};

LiskAPI.prototype.listActiveDelegates = function (limit, callback) {
	this.sendRequest('delegates/', { limit: limit}, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.listStandyDelegates = function (limit, callback) {
	var standByOffset = +101 + +limit;

	this.sendRequest('delegates/', { limit: limit, orderBy: 'rate:asc', offset: standByOffset}, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.searchDelegateByUsername = function (username, callback) {
	this.sendRequest('delegates/search/', { q: username }, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.listBlocks = function (amount, callback) {
	this.sendRequest('blocks', { totalAmount:amount }, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.listForgedBlocks = function (publicKey, callback) {
	this.sendRequest('blocks', { generatorPublicKey: publicKey }, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.getBlock = function (block, callback) {
	this.sendRequest('blocks', { height: block }, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.listTransactions = function (address, callback) {
	this.sendRequest('transactions', { senderId: address, recipientId: address, orderBy: 'timestamp:desc' }, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.getTransaction = function (transactionId, callback) {
	this.sendRequest('transactions/get', { id: transactionId }, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.listVotes = function (address, callback) {
	this.sendRequest('accounts/delegates', { address: address }, function (result) {
		return callback(result);
	});
};

LiskAPI.prototype.listVoters = function (publicKey, callback) {
	this.sendRequest('delegates/voters', { publicKey: publicKey }, function (result) {
		return callback(result);
	});
};

module.exports = LiskAPI;