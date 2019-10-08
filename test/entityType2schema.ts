/* tslint:disable:ordered-imports no-implicit-dependencies */
import test, { ExecutionContext, Implementation } from "ava";
import { parseEntityType } from "../src/parser";
// @ts-ignore
import { omitBy , isUndefined} from "lodash";
// @ts-ignore
// tslint:disable-next-line:no-var-requires
const fixtures = require("./fixtures/entityType2schema.json");

fixtures.forEach((fixture: any) => {
  test(fixture.title, (t: ExecutionContext) => {
    // as the parser can return undefined for various properties we ignore these to make defining the tests easier
    const schema = omitBy(parseEntityType(fixture.input), isUndefined);
    Object.keys(schema.properties).map(key => {
      schema.properties[key] = omitBy(schema.properties[key], isUndefined);
    });
    t.deepEqual(schema, fixture.output);
  });
});
