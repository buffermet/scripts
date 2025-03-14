/* Math polyfills. */

Math.seed = new Date().getMilliseconds();

/**
 * Returns pseudorandom float.
 */
Math.random = function() {
	r = Math.sin(Math.seed++) * 10000;
	return r - Math.floor(r);
};

