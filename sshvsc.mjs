#!/usr/bin/env node

const proxy = process.env.VSC_PROXY;
let browser = null;

function timeoutPromise(delay) {
    return new Promise((resolve, reject) => {
        if (delay < 0) {
            reject(new Error("Negative delay"));
        } else {
            let startTime = Date.now();
            setTimeout(() => {
                let elapsed = Date.now() - startTime;
                resolve(elapsed);
            }, delay);
        }   
    });     
}

async function getTokenFromWebsite() {

    const { default: puppeteer } = await import('puppeteer');

    let args = [];
    if (proxy)
        args = [ `--proxy-server=${proxy}` ];
    browser = await puppeteer.launch({
        headless: false,
        args: args,
    });

    const page = await browser.newPage();
    await page.setViewport(null);
    await page.goto("https://firewall.hpc.kuleuven.be");

    let bearer = null;
    let errorCount = 0;

    while (!bearer) {
        await timeoutPromise(500);
        try {
            bearer = await page.evaluate(() => {
                let span = document.querySelector("span#bearer");
                if (!span)
                    return null;
                return span.textContent;
            });
            errorCount = 0; // reset consecutive error count
        } catch(e) {
            console.log(`Error looking for bearer: ${e}`);
            errorCount++;
            if (errorCount == 10)
                throw Error("Maximum number of consecutive errors reached");
        }
    }
    console.log("Bearer from webpage is: " + bearer);

    return bearer;
}

async function main() {

    const commandArgs = process.argv.slice(2);

    const { default: os } = await import('os');
    const { default: path } = await import('path');
    const { default: fs } = await import('fs');
    const { spawnSync } = await import('child_process');

    const bearerFileName = path.join(os.homedir(), ".vscbearer.dat");
    let token = null;

    try {
        token = fs.readFileSync(bearerFileName, 'utf8').split("\n")[0];
    } catch (e) {
        console.log(`Can't read '${bearerFileName}': ${e.message}`)
    }

    let access = false;
    if (token) {
        const { SocksProxyAgent } = await import('socks-proxy-agent');
        const { default: nodeFetch } = await import('node-fetch');

        let agent = null;
        let fetchFn = fetch;

        if (proxy) {
            console.log("Using fetch proxy agent for " + proxy);
            agent = new SocksProxyAgent(proxy);
            fetchFn = nodeFetch;
        }
        const response = await fetchFn('https://firewall.hpc.kuleuven.be/fw/add',
            { method: "GET", headers: { "Authorization": token }, agent: agent });

        const data = await response.json();
        console.log(data);

        if (data.verified)
            access = true;
    }

    if (!access) { 
        let newBearerToken = await getTokenFromWebsite();
        fs.writeFileSync(bearerFileName, newBearerToken);
    }

    console.log("Waiting a second");
    await timeoutPromise(1000);

    console.log("Running ssh");
    const r = spawnSync("ssh", commandArgs, { stdio: "inherit" });

    if (browser) {
        try {
            browser.close();
        } catch (e) {
            console.log(`Warning: error when closing browser: ${e.message}`);
        }
    }
    console.log("Exiting");
    if (r.status !== null)
        process.exit(r.status);
    process.exit(-1);
}

try {
    await main();
} catch(e) {
    console.log(`Error: ${e}`);
    process.exit(-1);
}

