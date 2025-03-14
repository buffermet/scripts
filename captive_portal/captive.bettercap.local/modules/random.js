require("Math");

var _polyfill_Math_selectorIntegerValidator = new RegExp("^\\d+(?:\\.[0]{1,204})?$");

var random = {
	alphabeticLowercaseString: function(length) {
		length = parseInt(length);
		if (!_polyfill_Math_selectorIntegerValidator.test(length) || length <= 0) {
			log_error("invalid or missing length parameter in random.alphabeticLowercaseString function. (got " + length + ")");
			return "";
		}
		return random.generateString(random.charsAlphabeticLowercase, length);
	},
	alphabeticString: function(length) {
		length = parseInt(length);
		if (!_polyfill_Math_selectorIntegerValidator.test(length) || length <= 0) {
			log_error("invalid or missing length parameter in random.alphabeticString function. (got " + length + ")");
			return "";
		}
		return random.generateString(
			random.charsAlphabeticLowercase + random.charsAlphabeticUppercase,
			length);
	},
	alphabeticUppercaseString: function(length) {
		if (!_polyfill_Math_selectorIntegerValidator.test(length) || length <= 0) {
			log_error("invalid or missing length parameter in random.alphabeticUppercaseString function. (got " + length + ")");
			return "";
		}
		return random.generateString(random.charsAlphabeticUppercase, length);
	},
	alphanumericLowercaseString: function(length) {
		if (!_polyfill_Math_selectorIntegerValidator.test(length) || length <= 0) {
			log_error("invalid or missing length parameter in random.alphanumericLowercaseString function. (got " + length + ")");
			return "";
		}
		return random.generateString(
			random.charsAlphabeticLowercase + random.charsNumeric,
			length);
	},
	alphanumericString: function(length) {
		if (!_polyfill_Math_selectorIntegerValidator.test(length) || length <= 0) {
			log_error("invalid or missing length parameter in random.alphanumericString function. (got " + length + ")");
			return "";
		}
		return random.generateString(
			random.charsAlphabeticLowercase + random.charsAlphabeticUppercase
				+ random.charsNumeric,
			length);
	},
	alphanumericUppercaseString: function(length) {
		if (!_polyfill_Math_selectorIntegerValidator.test(length) || length <= 0) {
			log_error("invalid or missing length parameter in random.alphanumericUppercaseString function. (got " + length + ")");
			return "";
		}
		return random.generateString(
			random.charsAlphabeticUppercase + random.charsNumeric,
			length);
	},
	charsAlphabeticLowercase: "abcdefghijklmnopqrstuvwxyz",
	charsAlphabeticUppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	charsNumeric: "0123456789",
	generateString: function(chars, length) {
		var buff  = new Array(length);
		for (var a = 0; a < buff.length; a++)
			buff[a] = chars.charAt(Math.random() * chars.length);
		return buff.join("");
	},
};

