#!/usr/bin/env node

const proxy = process.env.VSC_PROXY;

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

    const { default: puppeteer } = await import('puppeter');

    let args = [];
    if (proxy)
        args = [ `--proxy-server=${proxy}` ];
    const browser = await puppeteer.launch({
        headless: false,
        args: args,
        //args: [ `--window-size=${windowWidth+extraWidth},${windowHeight+extraHeight}` ],
        //defaultViewport: { width: windowWidth, height: windowHeight },
    });

    const page = await browser.newPage();
    await page.goto("https://firewall.hpc.kuleuven.be");

    let bearer = null;
    while (!bearer) {
        await timeoutPromise(0.5);
        try {
            bearer = await page.evaluate(() => {
                let span = document.querySelector("span#bearer");
                if (!span)
                    return null;
                return span.textContent;
            });
        } catch(e) {
            console.log(`Error looking for bearer: ${e}`);
        }
    }
    console.log("Bearer from webpage is: " + bearer);
    await timeoutPromise(1000);

    browser.close();
    return bearer;
}

async function main() {

    const commandArgs = process.argv.slice(2);

    const { default: fs } = await import('fs');
    const { spawnSync } = await import('child_process');

    const bearerFileName = process.env.HOME + "/.vscbearer.dat"
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

