//const proxy = null;
const proxy = "socks5://172.18.15.237:1080"

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

    browser.close();
    return bearer;
}

async function main() {

    if (process.argv.length < 4) {
        throw new Error("Need login name and path to private key, optionally followed by a command");
    }

    const user = process.argv[2];
    const privKeyPath = process.argv[3];
    const command = process.argv.slice(4);
    console.log("user: " + user);
    console.log("privKeyPath: " + privKeyPath);

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

    console.log("Running ssh");
    spawnSync("ssh", [ "-4", "-A", "-t", "-i", privKeyPath, user + "@login.hpc.kuleuven.be", ...command ], { stdio: "inherit" });
}

try {
    await main();
} catch(e) {
    console.log(`Error: ${e}`);
}

