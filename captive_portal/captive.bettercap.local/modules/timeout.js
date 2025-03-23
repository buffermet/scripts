/**
 * Polyfill for setTimeout, clearTimeout, setInterval and clearInterval. This polyfill is
 * not backwards compatible with ECMAScript asynchronicity. Avoid recursion. Interval and
 * timeout delays are expressed in seconds instead of milliseconds.
 */

var _polyfill_timeout_tickers = {};

var _polyfill_timeout_lastTickerId = 0;

var _polyfill_timeout_tickerIdPrefix = "x7GzU2.";

/**
 * @param {int} id Name of the ticker.
 * @returns {boolean} ok
 */
function clearInterval(id) {
	if (_polyfill_timeout_tickers[id]) {
		// For some reason this removeEventListener causes a process to hold up a queue
		// and bettercap becomes unresponsive. (see issue )
//		removeEventListener(
//			"ticker." + _polyfill_timeout_tickerIdPrefix + id,
//			_polyfill_timeout_tickers[id]);
		delete _polyfill_timeout_tickers[id];
		run("ticker.destroy " + _polyfill_timeout_tickerIdPrefix + id);
	} else {
		console.error("error clearing interval/timeout: unknown id: " + id);
		return false;
	}
	return true;
}

/**
 * @param {int} id Name of the ticker.
 * @returns {boolean} ok
 */
function clearTimeout(id) {
	return clearInterval(id);
}

/**
 * @param {function} fn Function that will be continuously executed.
 * @param {int} s Delay in seconds before each execution.
 * @returns {int} id
 */
function setInterval(fn, s) {
	if (typeof(fn) !== "function") {
		console.error("first parameter must be a function.");
		return false;
	}
	if (!parseInt(s) || s < 1) {
		console.error("invalid or missing 's' parameter.");
		return false;
	}

	var id = _polyfill_timeout_lastTickerId++;
	_polyfill_timeout_tickers[id] = fn;

	onEvent("ticker." + _polyfill_timeout_tickerIdPrefix + id, fn);
	run("ticker.create " + _polyfill_timeout_tickerIdPrefix + id + " " + s + " !exit");

	return id;
}

/**
 * @param {function} fn Function that will be executed.
 * @param {int} s Delay in seconds before execution.
 * @returns {int} id
 */
function setTimeout(fn, s) {
	if (typeof(fn) !== "function") {
		console.error("first parameter must be a function.");
		return false;
	}
	if (!parseInt(s) || s < 1) {
		console.error("invalid or missing 's' parameter.");
		return false;
	}

	var id = _polyfill_timeout_lastTickerId++;
	_polyfill_timeout_tickers[id] = function() {
		fn();
		clearTimeout(id);
	};

	onEvent("ticker." + _polyfill_timeout_tickerIdPrefix + id, _polyfill_timeout_tickers[id]);
	run("ticker.create " + _polyfill_timeout_tickerIdPrefix + id + " " + s + " !exit");

	return id;
}

