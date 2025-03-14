var addr = env("captiveportal.address");
var hostname = env("captiveportal.hostname");
var ttl = env("captiveportal.dns.ttl");

var Rrtype = {
	None:  0,
	A:     1,
	CNAME: 5,
	AAAA:  28,
}

String.prototype.endsWith = function(suffix) {
	return this.slice(suffix.length) === suffix;
}

String.prototype.startsWith = function(prefix) {
	return this.slice(0, prefix.length) === prefix;
}

function onCommand(cmd) {
	var argv = cmd.split(" ");
	switch (argv[0]) {
	case "captiveportal.authorize":
		var ip = argv[1];
		if (!ip) {
			log_error("Missing client IP. Usage: captiveportal.authorize <CLIENT_IP>");
		} else {
			addSessionEvent("captiveportal.authorize", ip);
		}
		return true;
	case "captiveportal.unauthorize":
		var ip = argv[1];
		if (!ip) {
			log_error("Missing client IP. Usage: captiveportal.unauthorize <CLIENT_IP>");
		} else {
			addSessionEvent("captiveportal.unauthorize", ip);
		}
		return true;
	}
	return false;
}

function onRequest(req, res) {
	res.Header.Response = true;
	res.Header.RecursionAvailable = true;

	req.Questions.forEach(function(question) {
		if (question.Qtype === Rrtype.A) {
			res.Answers = res.Answers.concat({
				A: addr,
				Header: {
					Class: question.Qclass,
					Name: question.Name,
					Rrtype: question.Qtype,
					Ttl: ttl,
				}
			});
		}
		// Respond with AAAA records if necessary
	});

	if (res.Answers.length === 0) {
		res.Header.Rrtype = Rrtype.None;

		// Silence DNS errors by clearing all records
		res.Extras = [];
		res.Nameserver = [];
	}
}

function onLoad() {
	if (!addr) log_fatal("no 'captiveportal.address' specified.");
	if (hostname && !hostname.endsWith(".")) hostname += ".";
	if (ttl) {
		ttl = parseInt(ttl);
		if (ttl === NaN) {
			log_info("invalid or missing 'captiveportal.dns.ttl' specified, using default TTL of 1 second.");
			ttl = 1;
		}
	}
}
