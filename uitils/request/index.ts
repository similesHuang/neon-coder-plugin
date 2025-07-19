type RequestOptions = RequestInit & {
  interceptRequest?: (
    url: string,
    options: RequestInit
  ) =>
    | Promise<[string | URL | Request, RequestInit]>
    | [string | URL | Request, RequestInit];
  interceptResponse?: (response: Response) => Promise<Response> | Response;
};

const defaultRequestInterceptor: (
  url: string,
  options: RequestInit
) => Promise<[string | URL | Request, RequestInit]> = async (url, options) => [
  url,
  options,
];

const defaultResponseInterceptor = async (response: Response) => response;

async function httpRequest<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    interceptRequest = defaultRequestInterceptor,
    interceptResponse = defaultResponseInterceptor,
    ...fetchOptions
  } = options;

  const [finalUrl, finalOptions] = await interceptRequest(url, fetchOptions);

  const response = await fetch(finalUrl, finalOptions);

  const finalResponse = await interceptResponse(response);

  // 统一处理 JSON 响应
  if (finalResponse.headers.get("content-type")?.includes("application/json")) {
    return finalResponse.json();
  }
  return finalResponse as any;
}

httpRequest.get = <T = any>(url: string, options: RequestOptions = {}) =>
  httpRequest<T>(url, { ...options, method: "GET" });

httpRequest.post = <T = any>(
  url: string,
  body?: any,
  options: RequestOptions = {}
) =>
  httpRequest<T>(url, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

httpRequest.put = <T = any>(
  url: string,
  body?: any,
  options: RequestOptions = {}
) =>
  httpRequest<T>(url, {
    ...options,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

httpRequest.delete = <T = any>(url: string, options: RequestOptions = {}) =>
  httpRequest<T>(url, { ...options, method: "DELETE" });

export default httpRequest;
