import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretData, classifyRelease, normalizeReleases, safeLink } from '../public/insights.js';
test('missing market data does not manufacture interpretations',()=>assert.deepEqual(interpretData({}),[]));
test('funding direction and source coverage are preserved',()=>{
 const cards=interpretData({funding:-.0001,coverage:{funding:['A','B']}});
 assert.match(cards[0].fact,/2 家/);assert.match(cards[0].reading,/空头向多头/);
});
test('candidate version remains a candidate even if GitHub prerelease flag is false',()=>{
 assert.equal(classifyRelease({name:'aptos-node-v1.49.2-hotfix-rc',prerelease:false}).kind,'候选 / 测试版本');
 assert.match(classifyRelease({name:'mainnet-v1.2'}).fact,/不证明主网/);
});
test('news rejects unsafe URLs, drafts and invalid dates; sorts newest first',()=>{
 const data=[{name:'old',html_url:'https://github.com/a',published_at:'2026-01-01'},{name:'new',html_url:'https://github.com/b',published_at:'2026-02-01'},{html_url:'javascript:alert(1)',published_at:'2026-03-01'},{html_url:'https://github.com/c',published_at:'invalid'}];
 assert.equal(normalizeReleases(data).length,2);assert.equal(normalizeReleases(data)[0].title,'new');assert.equal(safeLink('javascript:alert(1)'),null);
});
