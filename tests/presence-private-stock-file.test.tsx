
import assert from"node:assert/strict";
import test from"node:test";
import{privateStockFilename}from"../scripts/intake/source-aware-stock";
test("scoped prepared stock filenames accept the actual PNG extension without permitting traversal or another image kind",()=>{
 for(const type of ["home","site"])assert.equal(privateStockFilename(type+"-42-9ac924e2-374e-41bc-b819-e69b2c5e297b.png"),type+"-42-9ac924e2-374e-41bc-b819-e69b2c5e297b.png");
 for(const file of ["../secret.png","/home-42-9ac924e2-374e-41bc-b819-e69b2c5e297b.png","home-0-9ac924e2-374e-41bc-b819-e69b2c5e297b.png","home-42-9ac924e2-374e-41bc-b819-e69b2c5e297bXpng","home-42-9ac924e2-374e-41bc-b819-e69b2c5e297b\\.png","home-42-9ac924e2-374e-41bc-b819-e69b2c5e297b.jpg",null])assert.throws(()=>privateStockFilename(file));
});
