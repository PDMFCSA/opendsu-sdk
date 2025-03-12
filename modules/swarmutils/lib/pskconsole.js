let commands = {};
let commands_help = {};

//global function addCommand
addCommand = function addCommand(verb, adverbe, funct, helpLine) {
    let cmdId;
    if (!helpLine) {
        helpLine = " ";
    } else {
        helpLine = " " + helpLine;
    }
    if (adverbe) {
        cmdId = verb + " " + adverbe;
        helpLine = verb + " " + adverbe + helpLine;
    } else {
        cmdId = verb;
        helpLine = verb + helpLine;
    }
    commands[cmdId] = funct;
    commands_help[cmdId] = helpLine;
};

function doHelp() {
    console.log("List of commands:");
    for (let l in commands_help) {
        console.log("\t", commands_help[l]);
    }
}

addCommand("-h", null, doHelp, "\t\t\t\t\t\t |just print the help");
addCommand("/?", null, doHelp, "\t\t\t\t\t\t |just print the help");
addCommand("help", null, doHelp, "\t\t\t\t\t\t |just print the help");


function runCommand() {
    let argv = Object.assign([], process.argv);
    let cmdId = null;
    let cmd = null;
    argv.shift();
    argv.shift();

    if (argv.length >= 1) {
        cmdId = argv[0];
        cmd = commands[cmdId];
        argv.shift();
    }


    if (!cmd && argv.length >= 1) {
        cmdId = cmdId + " " + argv[0];
        cmd = commands[cmdId];
        argv.shift();
    }

    if (!cmd) {
        if (cmdId) {
            console.log("Unknown command: ", cmdId);
        }
        cmd = doHelp;
    }

    cmd.apply(null, argv);

}

module.exports = {
    runCommand
};

