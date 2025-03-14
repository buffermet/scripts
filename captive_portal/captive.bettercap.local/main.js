var os = env("os");
os = "linux"; // remove when implemented
if (os === "windows") {
	log_fatal("This captive portal module is not supported on Windows.");
}

/**
 * Documentation can be found at https://github.com/bettercap/scripts/...
 */

// Choose your HTTP server's public directory (default=.)
run("set http.server.path /usr/local/share/bettercap/scripts/captive_portal/captive.bettercap.local/public_html");

// Choose address for the captive portal server (default=<interface address>)
// run("set captiveportal.address 10.0.0.1");
// Choose your captive portal hostname
run("set captiveportal.hostname captive.bettercap.local");
// Choose the path of the captive portal server that will attempt client authentication (default=/auth)
run("set captiveportal.path.auth /auth");
// Choose the path of the captive portal server that will serve the client's usage (default=/usage)
run("set captiveportal.path.usage /usage");
// Choose the TCP ports that the captive portal will always accept (if destined for the captive portal address)
run("set captiveportal.ports.tcp 53,80,8080,8053");
// Choose the UDP ports that the captive portal will always accept (if destined for the captive portal address)
run("set captiveportal.ports.udp 53");
// Choose the DNS resolver for authenticated clients (default=1.1.1.1)
run("set captiveportal.dns.resolver 1.1.1.1");
// Choose the Time To Live of DNS query responses that point to the captive portal address (seconds, default=1)
run("set captiveportal.dns.ttl 1");
// Choose how many seconds clients have to wait until they can re-authenticate (ignored if captiveportal.lease.resettime is set) (default=86400) (24h in seconds)
run("set captiveportal.lease.delay 1");
// Choose the download limit in bytes for active leases (binary, default=1073741824) (1 gigabyte)
run("set captiveportal.lease.downloadlimit 1073741824");
// Choose the duration of leases (seconds, default=3600) (1 hour)
run("set captiveportal.lease.duration 3600");
// Choose the file that leases are written to (default=)
run("set captiveportal.lease.file /usr/local/share/bettercap/scripts/captive_portal/captive.bettercap.local/session/leases.json");
// Choose at which time of day all leases will be removed and all clients are allowed to re-authenticate again (this will override captiveportal.lease.delay) (HH:mm:ss, default=)
// run("set captiveportal.lease.resettime 00:00:00");
// Choose the file that login attempts (sent to captiveportal.path.auth) are written to (default=)
run("set captiveportal.loginattempts.file /usr/local/share/bettercap/scripts/captive_portal/captive.bettercap.local/session/loginattempts.json");

// Configure HTTP proxy
run("set http.proxy.script /usr/local/share/bettercap/scripts/captive_portal/captive.bettercap.local/modules/http.proxy.js");

// Configure DNS proxy
run("set dns.proxy.script /usr/local/share/bettercap/scripts/captive_portal/captive.bettercap.local/modules/dns.proxy.js");

// Start captive portal
require("modules/captiveportal.js");

