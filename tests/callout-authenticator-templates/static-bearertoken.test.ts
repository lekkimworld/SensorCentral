import {expect} from "@jest/globals";
import auth from "../../src/callout-authenticator-templates/static-bearertoken";

describe('Testing static bearer token', () => {
  test('no mappings should fail', async () => {
    try {
        await auth([], {}, {
            id: "foo", name: "bar", baseUrl: "baz"
        })
        fail("Should fail");
    } catch (err) {}
  });
  test('incorrect mappings should fail', async () => {
    try {
        await auth([{id: "123", name: "foo", value: "baz"}], {"invalid": "foo"}, {
            id: "foo", name: "bar", baseUrl: "baz"
        })
        fail("Should fail");
    } catch (err) {}
  });
  test('correct mappings should work', async () => {
    const headers = await auth([{id: "123", name: "foo", value: "baz"}], {"token": "foo"}, {
        id: "foo", name: "bar", baseUrl: "baz"
    })
    expect(headers["Authorization"]).toBe("Bearer baz");
  });
});