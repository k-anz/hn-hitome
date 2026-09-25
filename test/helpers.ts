import type { Fetch } from "../src/hn";

type Route = unknown | (() => Response | Promise<Response>);

/** URL の前方一致でレスポンスを返す偽 fetch。関数ならそれを呼ぶ。どれにも当たらなければ 404 */
export function fakeFetch(
  routes: Record<string, Route>,
): Fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    for (const [prefix, route] of Object.entries(routes)) {
      if (!url.startsWith(prefix)) continue;
      if (typeof route === "function")
        return (route as () => Response | Promise<Response>)();
      return Response.json(route);
    }
    return new Response("not found", { status: 404 });
  };
  return Object.assign(fn as Fetch, { calls });
}
