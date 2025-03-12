const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read and parse the octopus.json file
const octopusJsonPath = path.join(process.cwd(), 'octopus.json');
const octopusJson = JSON.parse(fs.readFileSync(octopusJsonPath, 'utf8'));

// Function to execute git submodule add command
function addSubmodule(name, src) {
    const destinationPath = path.join('./modules', name);
    const command = `git submodule add ${src} ${destinationPath}`;

    console.log(`Adding submodule: ${name}`);
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`Successfully added submodule: ${name}`);
    } catch (error) {
        console.error(`Error adding submodule ${name}: ${error.message}`);
    }
}

// Iterate through dependencies and add submodules
octopusJson.dependencies.forEach(dep => {
    if (dep.name && dep.src && typeof dep.src === 'string' && dep.src.startsWith('http')) {
        addSubmodule(dep.name, dep.src);
    }
});

console.log('Finished adding submodules.');