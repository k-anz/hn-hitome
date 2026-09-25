import { writeSchema } from "../src/publish";

await writeSchema("public");
console.log("wrote public/schema.json");
