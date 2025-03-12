function InstallationDetails(server) {

    function getLog(targetPath, callback) {
        const child_process = require("child_process");
        const path = require("path");

        const basicProcOptions = {cwd: path.resolve(targetPath), stdio: [0, "pipe", "pipe"]};
        child_process.exec(" git log -n 1  --pretty=oneline", basicProcOptions, function (err, stdout) {
            if (err) {
                return callback(err);
            }
            let sep = " ";
            let fragments = stdout.split(sep);
            let details = {
                commitNo: fragments.shift(),
                commitMessage: fragments.join(sep)
            };
            return callback(undefined, details);
        });
    }

    function sendSummary(res, summary) {
        res.setHeader('Content-Type', 'application/json');
        res.write(JSON.stringify(summary));
        res.end();
    }

    function detailsHandler(req, res) {
        const path = require("path");
        //targetPath = the workspace folder
        let targetPath = path.resolve("..");
        let summary = {};
        summary.resourceUsage = getProcessResourceUsage();
        getLog(targetPath, (err, log) => {
            if (err) {
                res.statusCode = 500;
                res.end("Failed to read log");
                return;
            }
            summary[path.basename(targetPath)] = log;

            //targetPath = the privatesky folder
            let tPath = path.resolve(".");
            getLog(tPath, (err, log) => {
                if (err) {
                    return sendSummary(res, {err, summary});
                }
                summary[path.basename(tPath)] = log;
                return sendSummary(res, summary);
            });
        });
    }

    function getProcessResourceUsage() {
        const resourceUsage = process.resourceUsage();
        resourceUsage.uptime = process.uptime();
        return resourceUsage;
    }

    server.get("/installation-details", detailsHandler);
}

module.exports = InstallationDetails;