/* ============================================================
   JIYE 集页 · 真实 AI 服务层
   接入真实大模型（GPT-OSS，通过 Pollinations 免费推理网关）
   - JYAI.evaluate(portfolioText)  真实作品集测评 → 结构化 JSON
   - JYAI.ask(messages)            多轮追问对话
   ============================================================ */
(function () {
  'use strict';

  var ENDPOINT = 'https://text.pollinations.ai/';
  var MODEL = 'openai-fast';
  var TIMEOUT_MS = 120000;

  function callAPI(messages, retry) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        private: true,
        messages: messages
      })
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('AI 服务暂时繁忙（' + r.status + '）');
      return r.text();
    }).catch(function (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('AI 思考超时，请再试一次');
      throw e;
    });
  }

  /* 从模型输出中稳健提取 JSON（兼容 ```json 代码块包裹） */
  function extractJSON(text) {
    if (!text) throw new Error('AI 返回为空');
    var cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) {}
    var m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e2) {}
    }
    throw new Error('AI 结果解析失败');
  }

  var SYSTEM_EVAL =
    '你是一名严格但友善的高校毕业作品集评审专家，有丰富的设计与求职评审经验。' +
    '请根据用户提供的【真实作品集内容】进行独立、真实的评分，严禁给人情分。' +
    '评分要求：' +
    '1) 所有分数为 0-100 的整数，严格依据内容完整度与质量，内容越简略分数应越低；' +
    '2) 缺少过程稿、分工、背景信息的项目必须扣分并指出；' +
    '3) 优点至少 2 条，问题必须给出可操作的具体改进建议；' +
    '4) impact 为完善该问题后预计提升的分数（1-10 的整数）。' +
    '只输出 JSON，不要输出 markdown 代码块、注释或任何多余文字。JSON 结构：' +
    '{"overall":0,"scores":{"content":0,"visual":0,"structure":0,"info":0,"process":0},' +
    '"strengths":[""],"issues":[{"title":"","suggestion":"","impact":0}],"summary":""}';

  window.JYAI = {
    /* 真实测评 */
    evaluate: function (portfolioText) {
      var attempt = 0;
      function run() {
        attempt++;
        var extra = attempt > 1
          ? '\n（特别提醒：上一次输出格式有误，本次必须只输出一个合法 JSON 对象，不要代码块。）'
          : '';
        return callAPI([
          { role: 'system', content: SYSTEM_EVAL },
          { role: 'user', content: portfolioText + extra }
        ]).then(extractJSON).then(function (data) {
          // 数值兜底
          data.overall = clampNum(data.overall);
          Object.keys(data.scores || {}).forEach(function (k) {
            data.scores[k] = clampNum(data.scores[k]);
          });
          return data;
        }).catch(function (e) {
          if (attempt < 2) return run();
          throw e;
        });
      }
      return run();
    },

    /* 多轮追问 */
    ask: function (messages) {
      return callAPI(messages).then(function (text) { return text.trim(); });
    },

    systemContext: function (portfolioText, result) {
      return '你正在帮助一名毕业生改进他的作品集。以下是作品集信息与你的评审结果，请基于这些信息继续回答，回答要具体、可操作，控制在 200 字以内。\n\n' +
        '【作品集信息】\n' + portfolioText + '\n\n【评审结果】\n' + JSON.stringify(result);
    }
  };

  function clampNum(v) {
    v = parseInt(v, 10);
    if (isNaN(v)) v = 0;
    return Math.max(0, Math.min(100, v));
  }
})();
