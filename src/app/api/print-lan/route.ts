import { NextResponse } from "next/server";
import net from "net";
import os from "os";
import http from "http";

function getLocalSubnets(): string[] {
  const subnets: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name] || [];
    for (const iface of list) {
      if (iface.family === "IPv4" && !iface.internal) {
        const parts = iface.address.split(".");
        if (parts.length === 4) {
          subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}.`);
        }
      }
    }
  }
  return Array.from(new Set(subnets));
}

/**
 * Dynamically queries the printer device for its actual name without static string matching:
 * 1. Queries printer hardware model via standard ESC/POS GS I 67 command over TCP port 9100
 * 2. If not ESC/POS, reads device title dynamically from device web interface
 */
async function queryPrinterDeviceName(ip: string): Promise<string> {
  // 1. Try querying the hardware model directly from the printer firmware via standard ESC/POS GS I 67
  const escposName = await new Promise<string | null>((resolve) => {
    const s = new net.Socket();
    s.setTimeout(500);
    s.connect(9100, ip, () => {
      s.write(Buffer.from([0x1d, 0x49, 67]));
    });
    s.on("data", (data) => {
      const clean = data.toString("utf8").replace(/[\x00-\x1F\x7F_]/g, "").trim();
      s.destroy();
      resolve(clean || null);
    });
    s.on("error", () => resolve(null));
    s.on("timeout", () => {
      s.destroy();
      resolve(null);
    });
  });

  if (escposName) {
    return escposName;
  }

  // 2. Query device web page for <title> (following redirects)
  const htmlTitle = await new Promise<string | null>((resolve) => {
    function fetchUrl(url: string, hops: number) {
      if (hops > 3) return resolve(null);
      const req = http.get(url, { timeout: 700 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith("http")
            ? res.headers.location
            : `http://${ip}${res.headers.location}`;
          return fetchUrl(loc, hops + 1);
        }
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          const m = body.match(/<title>([^<]+)<\/title>/i);
          resolve(m ? m[1].trim() : null);
        });
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
    }
    fetchUrl(`http://${ip}/`, 0);
  });

  return htmlTitle || `Printer (${ip})`;
}

async function scanSubnetForPort9100(base: string): Promise<string[]> {
  const discovered: string[] = [];
  const promises: Promise<void>[] = [];

  for (let i = 1; i <= 254; i++) {
    const ip = `${base}${i}`;
    promises.push(
      new Promise<void>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(600);

        socket.on("connect", () => {
          discovered.push(ip);
          socket.destroy();
          resolve();
        });

        socket.on("error", () => {
          socket.destroy();
          resolve();
        });

        socket.on("timeout", () => {
          socket.destroy();
          resolve();
        });

        socket.connect(9100, ip);
      })
    );
  }

  await Promise.all(promises);
  return discovered;
}

/**
 * Test connectivity or discover devices on local subnet listening on raw printer port 9100
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Auto-Discovery Mode: /api/print-lan?discover=true
  if (searchParams.get("discover") === "true") {
    try {
      const subnets = getLocalSubnets();
      const allFoundIps: string[] = [];

      for (const base of subnets) {
        const found = await scanSubnetForPort9100(base);
        allFoundIps.push(...found);
      }

      // Dynamically query each found device for its actual hardware or device name
      const printers = await Promise.all(
        allFoundIps.map(async (ip) => {
          const name = await queryPrinterDeviceName(ip);
          return {
            ip,
            port: 9100,
            name,
          };
        })
      );

      return NextResponse.json({
        success: true,
        count: printers.length,
        printers,
        source: "nextjs-api-route",
      });
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        error: err.message || "Failed to scan subnet",
        printers: [],
      });
    }
  }

  // Connectivity test for a specific IP
  const ip = searchParams.get("ip");
  if (!ip) {
    return NextResponse.json({ online: false, error: "No IP address specified" }, { status: 400 });
  }
  const port = parseInt(searchParams.get("port") || "9100", 10);

  return new Promise<NextResponse>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);

    socket.on("connect", () => {
      socket.destroy();
      resolve(
        NextResponse.json({
          online: true,
          ip,
          port,
          message: `Printer online at ${ip}:${port}`,
        })
      );
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(
        NextResponse.json(
          { online: false, ip, port, error: "Connection timed out" },
          { status: 504 }
        )
      );
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve(
        NextResponse.json(
          { online: false, ip, port, error: err.message },
          { status: 502 }
        )
      );
    });

    socket.connect(port, ip);
  });
}

/**
 * Send raw ESC/POS receipt bytes over TCP port 9100 to the LAN printer
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ip = (body.ip || "").trim();
    if (!ip) {
      return NextResponse.json(
        { success: false, error: "No printer IP address provided" },
        { status: 400 }
      );
    }
    const port = parseInt(body.port || "9100", 10);
    const base64Data = body.data;

    if (!base64Data) {
      return NextResponse.json(
        { success: false, error: "No print data provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(base64Data, "base64");

    return new Promise<NextResponse>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(4000);

      socket.on("connect", () => {
        socket.write(buffer, () => {
          // Allow thermal printer buffer time to process before closing TCP session
          setTimeout(() => {
            try {
              socket.end();
            } catch (e) {}
            resolve(
              NextResponse.json({
                success: true,
                message: `Printed successfully to ${ip}:${port}`,
              })
            );
          }, 600);
        });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(
          NextResponse.json(
            { success: false, error: "Printer socket timeout" },
            { status: 504 }
          )
        );
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve(
          NextResponse.json(
            { success: false, error: `Socket error: ${err.message}` },
            { status: 502 }
          )
        );
      });

      socket.connect(port, ip);
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process print request" },
      { status: 500 }
    );
  }
}
