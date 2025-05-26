import fetch from "node-fetch";
import { AuthenticatorTemplate } from "../../src/callout-authenticator-templates/templates";
import CalloutService, { RequestData } from "../../src/services/callout-service";
import { StorageService } from "../../src/services/storage-service";
import { BackendIdentity, CalloutSecret, Identity } from "../../src/types";

jest.mock("node-fetch");
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

const ident : BackendIdentity = {
            identity: {} as Identity,
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
            method: "GET",
            url: "https://example.com",
            body: undefined,
            headers: {}
        })
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", {headers: {}, method: "GET"});
    })
    it("should use POST if instructed", async () => {
        mockFetch.mockImplementation(() : any => {
            return {
                ok: true,
                text() {}
            }
        })
        await new CalloutService().request({
            method: "POST",
            url: "https://example.com",
            body: "abc123",
            headers: {}
        })
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", {headers: {}, body: "abc123", method: "POST"});
    })
    it("undefined body on POST should be empty string", async () => {
        mockFetch.mockImplementation(() : any => {
            return {
                ok: true,
                text() {}
            }
        })
        await new CalloutService().request({
            method: "POST",
            url: "https://example.com",
            body: undefined,
            headers: {}
        })
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", {headers: {}, body: "", method: "POST"});
    })
    it("should use supplied headers and return as json is accept is set to json", async () => {
        mockFetch.mockImplementation(() : any => {
            return {
                ok: true,
                json() {}
            }
        })
        await new CalloutService().request({
            method: "GET",
            url: "https://example.com",
            headers: {"foo": "bar", "accept": "application/json"}
        })
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", {headers: {"foo": "bar", "accept": "application/json"}, method: "GET"});
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
                method: "GET",
                url: "https://example.com",
                body: undefined,
                headers: {}
            })
            fail("Should fail");
        } catch (err) {}
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com", {headers: {}, method: "GET"});
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
        c.init(callback, [ mockStorage ]);
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
            method: "GET",
            endpoint: {
                id: "emdpoint_id", name: "foo", baseUrl: "https://example.com"
            },
            pathTemplate: "",
            bodyTemplate: undefined
        }, {});
        
        expect(storage.getUserCalloutSecrets).toHaveBeenCalledTimes(1);
        expect(calloutSvc.request).toHaveBeenCalledTimes(1);
        expect(calloutSvc.request).toHaveBeenCalledWith({
            method: "GET",
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
            method: "POST",
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
            method: "POST",
            url: "https://example.com/1/2",
            body: "2-1",
            headers: {"x-foo": "bar"}
        } as RequestData)

    })

    it("test authenticator", async () => {
        const calloutSvc = c!;
        
        const endpoint = {
            id: "endpoint_id", name: "foo", baseUrl: "xxx://example.com"
        }
        await calloutSvc.callout(ident, {
            id: "id",
            name: "myname",
            method: "GET",
            endpoint,
            pathTemplate: "",
            authenticator: {
                endpoint, 
                id: "foo",
                name: "myauth",
                template: AuthenticatorTemplate["STATIC-BEARERTOKEN"],
                templateMappings: {
                    "token": {
                        name: "foo-secret", id: "xyz123", value: "shhhhh...."
                    }
                }
            }
        }, {});
        
        expect(calloutSvc.request).toHaveBeenCalledWith({
            method: "GET",
            url: "xxx://example.com",
            headers: {
                "Authorization": "Bearer shhhhh...."
            }
        } as RequestData)

    })
    
})