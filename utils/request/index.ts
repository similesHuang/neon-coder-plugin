type RequestOptions = RequestInit & {
  interceptRequest?: (
    url: string,
    options: RequestInit
  ) =>
    | Promise<[string | URL | Request, RequestInit]>
    | [string | URL | Request, RequestInit];
  interceptResponse?: (response: Response) => Promise<Response> | Response;
};

interface HttpRequest {
  <T = any>(url: string, options?: RequestOptions): Promise<T>;
  get: <T = any>(url: string, options?: RequestOptions) => Promise<T>;
  post: <T = any>(url: string, options?: RequestOptions) => Promise<T>;
  put: <T = any>(url: string, options?: RequestOptions) => Promise<T>;
  delete: <T = any>(url: string, options?: RequestOptions) => Promise<T>;
  [key: string]: any;
}

const defaultRequestInterceptor: (
  url: string,
  options: RequestInit
) => Promise<[string | URL | Request, RequestInit]> = async (url, options) => [
  url,
  options,
];

const defaultResponseInterceptor = async (response: Response) => response;

const httpRequest = async function httpRequest<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    interceptRequest = defaultRequestInterceptor,
    interceptResponse = defaultResponseInterceptor,
    body,
    ...restOptions
  } = options;

  const fetchOptions: RequestInit = { ...restOptions };

  // 处理 body，自动序列化为 JSON 字符串（仅 POST/PUT/PATCH）
  let finalBody = body;
  const method = (fetchOptions.method || "GET").toUpperCase();
  if (
    finalBody !== undefined &&
    ["POST", "PUT", "PATCH"].includes(method) &&
    typeof finalBody !== "string"
  ) {
    fetchOptions.body = JSON.stringify(finalBody);
    fetchOptions.headers = {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    };
  } else if (finalBody !== undefined) {
    fetchOptions.body = finalBody;
  }

  const [finalUrl, finalOptions] = await interceptRequest(url, fetchOptions);

  const response = await fetch(finalUrl, finalOptions);

  const finalResponse = await interceptResponse(response);

  // 统一处理 JSON 响应
  if (finalResponse.headers.get("content-type")?.includes("application/json")) {
    return finalResponse.json();
  }
  return finalResponse as any;
} as HttpRequest;

httpRequest.get = <T = any>(url: string, options: RequestOptions = {}) =>
  httpRequest<T>(url, { ...options, method: "GET" });

httpRequest.post = <T = any>(url: string, options: RequestOptions = {}) =>
  httpRequest<T>(url, { ...options, method: "POST" });

httpRequest.put = <T = any>(url: string, options: RequestOptions = {}) =>
  httpRequest<T>(url, { ...options, method: "PUT" });

httpRequest.delete = <T = any>(url: string, options: RequestOptions = {}) =>
  httpRequest<T>(url, { ...options, method: "DELETE" });

export default httpRequest;
