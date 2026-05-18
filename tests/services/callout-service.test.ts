import { AuthenticatorTemplate } from "../../src/callout-authenticator-templates/templates";
import CalloutService, { RequestData } from "../../src/services/callout-service";
import { IdentityService } from "../../src/services/identity-service";
import { StorageService } from "../../src/services/storage-service";
import { BackendIdentity, CalloutSecret, HttpMethod, Identity } from "../../src/types";

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const ident : BackendIdentity = {
            identity: { callerId: "*" } as Identity,
            principal: {
                isUser: function (): boolean {
                    throw new Error("Function not implemented.");
                },
                isDevice: function (): boolean {
                    throw new Error("Function not implemented.");
                },
                isSystem: function (): boolean {
                    throw new Error("Function not implemented.");
                }
            },
            scopes: []
        }

const mockIdentity = {
    getServiceBackendIdentity: () => ident,
    getImpersonationIdentity: () => ident,
} as unknown as IdentityService;

describe ("callout-service.request", () => {

    beforeEach(() => {
        mockFetch.mockReset();
    })

    it("should use GET if instructed", async () => {
        mockFetch.mockImplementation(() : any => {
            return {
                ok: true,
                text() {}
            }
        })
        await new CalloutService().request({
            method: HttpMethod.GET,
            url: "https://example.com",
            body: undefined,
            headers: {}
        })
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", expect.objectContaining({method: "GET"}));
    })
    it("should use POST if instructed", async () => {
        mockFetch.mockImplementation(() : any => {
            return {
                ok: true,
                text() {}
            }
        })
        await new CalloutService().request({
            method: HttpMethod.POST,
            url: "https://example.com",
            body: "abc123",
            headers: {}
        })
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", expect.objectContaining({body: "abc123", method: "POST"}));
    })
    it("undefined body on POST should be empty string", async () => {
        mockFetch.mockImplementation(() : any => {
            return {
                ok: true,
                text() {}
            }
        })
        await new CalloutService().request({
            method: HttpMethod.POST,
            url: "https://example.com",
            body: undefined,
            headers: {}
        })
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", expect.objectContaining({body: "", method: "POST"}));
    })
    it("should use supplied headers and return as json is accept is set to json", async () => {
        mockFetch.mockImplementation(() : any => {
            return {
                ok: true,
                text() { return Promise.resolve("{}"); }
            }
        })
        await new CalloutService().request({
            method: HttpMethod.GET,
            url: "https://example.com",
            headers: {"foo": "bar", "accept": "application/json"}
        })
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", expect.objectContaining({
            headers: expect.objectContaining({"foo": "bar", "accept": "application/json"}),
            method: "GET"
        }));
    })
    it("should throw exception on non-ok", async () => {
        mockFetch.mockImplementation(() : any => {
            return {
                ok: false
            }
        })
        const c = new CalloutService();
        try {
            await c.request({
                method: HttpMethod.GET,
                url: "https://example.com",
                body: undefined,
                headers: {}
            })
            fail("Should fail");
        } catch (err) {}
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", expect.objectContaining({method: "GET"}));
    })
})

describe ("callout-service.callout", () => {
    const callback = jest.fn();
    let mockStorage : StorageService|undefined = undefined;
    let secrets : Array<CalloutSecret> = [];
    let c : CalloutService | undefined = undefined; 

    beforeEach(async () => {
        callback.mockReset();
        mockStorage = new StorageService();
        jest.spyOn(mockStorage, "getUserCalloutSecrets").mockImplementation(() => {
            return Promise.resolve(secrets)
        });
        c = new CalloutService();
        jest.spyOn(c, "request").mockImplementation(() => {
            return Promise.resolve();
        });
        c.init(callback, [ mockStorage, mockIdentity ]);
    })

    afterEach(() => {
        expect(callback).toHaveBeenCalledTimes(1);
    })
    
    it("test simple callout - no authenticator", async () => {
        const storage = mockStorage!;
        const calloutSvc = c!;

        await calloutSvc.callout(ident, {
            id: "id",
            name: "myname",
            method: HttpMethod.GET,
            endpoint: {
                id: "emdpoint_id", name: "foo", baseUrl: "https://example.com"
            },
            pathTemplate: "",
            bodyTemplate: undefined
        }, {});
        
        expect(storage.getUserCalloutSecrets).toHaveBeenCalledTimes(1);
        expect(calloutSvc.request).toHaveBeenCalledTimes(1);
        expect(calloutSvc.request).toHaveBeenCalledWith({
            method: HttpMethod.GET,
            url: "https://example.com",
            headers: {}
        } as RequestData)

    })

    it("test simple callout - transfer headers and body/path template", async () => {
        const storage = mockStorage!;
        const calloutSvc = c!;

        await calloutSvc.callout(ident, {
            id: "id",
            name: "myname",
            method: HttpMethod.POST,
            endpoint: {
                id: "emdpoint_id", name: "foo", baseUrl: "https://example.com"
            },
            headers: {
                "x-foo": "bar"
            },
            pathTemplate: "/{{a}}/{{b}}",
            bodyTemplate: "{{b}}-{{a}}"
        }, {"a": "1", "b": "2"});
        
        expect(storage.getUserCalloutSecrets).toHaveBeenCalledTimes(1);
        expect(calloutSvc.request).toHaveBeenCalledTimes(1);
        expect(calloutSvc.request).toHaveBeenCalledWith({
            method: HttpMethod.POST,
            url: "https://example.com/1/2",
            body: "2-1",
            headers: {"x-foo": "bar"}
        } as RequestData)

    })

    it("test secrets available in body and path templates", async () => {
        const calloutSvc = c!;
        secrets = [
            { id: "s1", name: "My Token", value: "secret123" },
            { id: "s2", name: "API Key", value: "key456" },
        ];

        await calloutSvc.callout(ident, {
            id: "id",
            name: "myname",
            method: HttpMethod.POST,
            endpoint: {
                id: "endpoint_id", name: "foo", baseUrl: "https://example.com"
            },
            pathTemplate: "/notify/{{secrets.my_token}}",
            bodyTemplate: '{"key": "{{secrets.api_key}}"}'
        }, {});

        expect(calloutSvc.request).toHaveBeenCalledWith({
            method: HttpMethod.POST,
            url: "https://example.com/notify/secret123",
            body: '{"key": "key456"}',
            headers: {}
        } as RequestData);
    })

    it("test app dictionary available in body and path templates", async () => {
        const calloutSvc = c!;
        secrets = [];

        await calloutSvc.callout(ident, {
            id: "id",
            name: "myname",
            method: HttpMethod.POST,
            endpoint: {
                id: "endpoint_id", name: "foo", baseUrl: "https://hooks.example.com"
            },
            pathTemplate: "/callback",
            bodyTemplate: '{"url": "{{app.url}}/api/v1/data", "host": "{{app.hostname}}", "proto": "{{app.protocol}}"}'
        }, {});

        expect(calloutSvc.request).toHaveBeenCalledWith({
            method: HttpMethod.POST,
            url: "https://hooks.example.com/callback",
            body: expect.stringContaining('"proto": "'),
            headers: {}
        } as RequestData);
        const call = (calloutSvc.request as jest.Mock).mock.calls[0][0] as RequestData;
        const body = JSON.parse(call.body!);
        expect(body.proto).toBe("https");
        expect(body.host).toBeTruthy();
        expect(body.url).toMatch(/^https?:\/\/.+\/api\/v1\/data$/);
    })

    it("test app and secrets combined in templates", async () => {
        const calloutSvc = c!;
        secrets = [
            { id: "s1", name: "webhook secret", value: "wh_abc" },
        ];

        await calloutSvc.callout(ident, {
            id: "id",
            name: "myname",
            method: HttpMethod.POST,
            endpoint: {
                id: "endpoint_id", name: "foo", baseUrl: "https://hooks.example.com"
            },
            pathTemplate: "/hook/{{secrets.webhook_secret}}",
            bodyTemplate: '{"callback": "{{app.url}}/events"}'
        }, {});

        const call = (calloutSvc.request as jest.Mock).mock.calls[0][0] as RequestData;
        expect(call.url).toBe("https://hooks.example.com/hook/wh_abc");
        const body = JSON.parse(call.body!);
        expect(body.callback).toMatch(/^https?:\/\/.+\/events$/);
    })

    it("test authenticator", async () => {
        const calloutSvc = c!;
        
        const endpoint = {
            id: "endpoint_id", name: "foo", baseUrl: "xxx://example.com"
        }
        await calloutSvc.callout(ident, {
            id: "id",
            name: "myname",
            method: HttpMethod.GET,
            endpoint,
            pathTemplate: "",
            authenticator: {
                endpoint, 
                id: "foo",
                name: "myauth",
                template: AuthenticatorTemplate.STATIC_BEARERTOKEN,
                templateMappings: {
                    "token": {
                        name: "foo-secret", id: "xyz123", value: "shhhhh...."
                    }
                }
            }
        }, {});
        
        expect(calloutSvc.request).toHaveBeenCalledWith({
            method: HttpMethod.GET,
            url: "xxx://example.com",
            headers: {
                "Authorization": "Bearer shhhhh...."
            }
        } as RequestData)

    })
    
})