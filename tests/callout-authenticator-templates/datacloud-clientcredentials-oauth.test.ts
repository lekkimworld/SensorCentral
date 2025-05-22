import {expect} from "@jest/globals";
import auth from "../../src/callout-authenticator-templates/datacloud-clientcredentials-oauth";
import getService from "../../src/services/service-locator";
import { randomUUID } from "crypto";

jest.mock("../../src/services/service-locator");
const mockedGetService = getService as jest.MockedFunction<typeof getService>


const endpoint = {
    id: "foo", name: "bar", baseUrl: "baz"
}
const clientId = {id: "1", name: "my_clientid", value: "foo-client-id"}
const clientSecret = {id: "2", name: "my_clientsecret", value: "foo-client-secret"}

describe('Testing data cloud clientcredentials flow', () => {
  test('missing mappings should fail', async () => {
    
    try {
        await auth([], {}, endpoint);
        fail("Should fail");
    } catch (err) {}
    try {
        await auth([clientId, clientSecret], {"client_id": "my_clientid"}, endpoint)
        fail("Should fail");
    } catch (err) {}
    try {
        await auth([clientId, clientSecret], {"client_secret": "my_clientsecret"}, endpoint)
        fail("Should fail");
    } catch (err) {}
    try {
        await auth([clientId, clientSecret], {"client_id_xxx": "my_clientid", "client_secret": "my_clientsecret"}, endpoint)
        fail("Should fail");
    } catch (err) {}
    
  });
  test('should fail if first call return non-ok', async () => {
    mockedGetService.mockImplementation(() => {
      return {
        dependencies: [],
        name: "boo",
        request: () => {
          throw new Error();
        },
        terminate: async () => {},
        init(_callback, _services) {
          
        },
      };
    })
    try {
      await auth([clientId, clientSecret], {"client_id": "my_clientid", "client_secret": "my_clientsecret"}, endpoint)
      fail("should fail");
    } catch (err) {}
  });
  test('should fail if second call return non-ok', async () => {
    mockedGetService.mockImplementation(() => {
      let first = true;
      return {
        dependencies: [],
        name: "boo",
        request: () => {
          if (first) {
            first = false;
            return {"access_token": "foo"};
          } else {
            throw new Error();
          }
        },
        terminate: async () => {},
        init(_callback, _services) {
          
        },
      };
    })
    try {
      await auth([clientId, clientSecret], {"client_id": "my_clientid", "client_secret": "my_clientsecret"}, endpoint)
      fail("should fail");
    } catch (err) {}
  });
  test('should succeed if both calls succeed', async () => {
    const uuid = randomUUID().toString();
    mockedGetService.mockImplementation(() => {
      let first = true;
      return {
        dependencies: [],
        name: "boo",
        request: () => {
          if (first) {
            first = false;
            return {"access_token": "foo"};
          } else {
            return {"access_token": uuid};
          }
        },
        terminate: async () => {},
        init(_callback, _services) {
          
        },
      };
    })
    const resp = await auth([clientId, clientSecret], {"client_id": "my_clientid", "client_secret": "my_clientsecret"}, endpoint)
    expect(resp["Authorization"]).toBe(`Bearer ${uuid}`);
  });

});