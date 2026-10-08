/* ============================================================
   JIYE 集页 · 本地智能测评引擎
   - 无需外部 AI 接口，纯本地评分，国内 100% 可用
   - JYAI.evaluate(portfolioText)  作品集测评 → 结构化 JSON
   - JYAI.ask(messages)            追问对话
   ============================================================ */
(function () {
  'use strict';

  var THINK_DELAY = 1500;

  function parsePortfolio(text) {
    var info = { title: '', major: '', style: '', projects: [], pages: [] };
    var lines = text.split('\n');
    var curProj = null;
    lines.forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var m;
      if ((m = line.match(/^作品集标题[：:]\s*(.+)/))) {
        info.title = m[1];
      } else if ((m = line.match(/^所属专业[：:]\s*(.+)/))) {
        info.major = m[1];
      } else if ((m = line.match(/^整体风格[：:]\s*(.+)/))) {
        info.style = m[1];
      } else if ((m = line.match(/^项目(\d+)[：:]\s*(.+)/))) {
        if (curProj) info.projects.push(curProj);
        curProj = { name: m[2], desc: '', role: '', hasProcess: false };
      } else if (curProj && (m = line.match(/^描述[：:]\s*(.+)/))) {
        curProj.desc = m[1];
      } else if (curProj && (m = line.match(/^分工[：:]\s*(.+)/))) {
        curProj.role = m[1];
      } else if (curProj && (m = line.match(/^过程稿[：:]\s*(.+)/))) {
        curProj.hasProcess = (m[1] === '有');
      } else if ((m = line.match(/^已包含页面[：:]\s*(.+)/))) {
        var p = m[1];
        if (p && p !== '无') {
          info.pages = p.split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
        }
      }
    });
    if (curProj) info.projects.push(curProj);
    return info;
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function scoreContent(info) {
    var base = 50;
    base += info.projects.length * 8;
    info.projects.forEach(function (p) {
      var len = (p.desc || '').length;
      if (len > 100) base += 8;
      else if (len > 50) base += 5;
      else if (len > 10) base += 2;
    });
    return clamp(base, 0, 100);
  }

  function scoreVisual(info) {
    var styleMap = { '甜美可爱': 78, '极简清新': 82, '梦幻渐变': 80, '暖色治愈': 76, '高级黑白': 85, '商务专业': 83 };
    var base = styleMap[info.style] || 75;
    info.projects.forEach(function (p) { if ((p.desc || '').length > 30) base += 2; });
    return clamp(base, 0, 100);
  }

  function scoreStructure(info) { return clamp(50 + info.pages.length * 12, 0, 100); }

  function scoreInfo(info) {
    var base = 45;
    if (info.title && info.title !== '未填写') base += 10;
    if (info.major) base += 8;
    info.projects.forEach(function (p) { if (p.role && p.role !== '未填写') base += 6; });
    return clamp(base, 0, 100);
  }

  function scoreProcess(info) {
    var base = 20;
    info.projects.forEach(function (p) { if (p.hasProcess) base += 25; });
    return clamp(base, 0, 100);
  }

  function genStrengths(info, scores) {
    var list = [];
    var keys = Object.keys(scores);
    keys.sort(function (a, b) { return scores[b] - scores[a]; });
    var topDims = keys.slice(0, 2);
    var dimName = { content: '内容完整性', visual: '视觉表现力', structure: '结构清晰度', info: '信息充分度', process: '过程展示' };
    topDims.forEach(function (k) {
      var s = scores[k];
      if (s >= 75) list.push(dimName[k] + '表现突出（' + s + '分），' + strengthReason(k, info));
    });
    if (info.projects.length >= 2) list.push('作品数量充足，展示了多个不同方向的实践经历');
    if (info.title && info.title !== '未填写') list.push('作品集标题明确，主题定位清晰');
    if (info.pages.length >= 3) list.push('页面结构完整，包含' + info.pages.length + '个核心板块');
    if (list.length < 2) {
      list.push('整体框架已搭建成型，具备进一步打磨的基础');
      list.push('所选风格（' + info.style + '）与专业方向匹配度较高');
    }
    return list.slice(0, 6);
  }

  function strengthReason(k, info) {
    switch (k) {
      case 'content': return '项目内容详实，描述充分';
      case 'visual': return '视觉风格统一且有辨识度';
      case 'structure': return '板块安排合理，层次分明';
      case 'info': return '关键信息交代清楚';
      case 'process': return '过程稿展示到位，能体现思考路径';
      default: return '表现不错';
    }
  }

  function genIssues(info, scores) {
    var issues = [];
    var dimName = { content: '内容完整性', visual: '视觉表现力', structure: '结构清晰度', info: '信息充分度', process: '过程展示' };
    var dimSuggestion = {
      content: '补充更多项目细节，包括创作背景、目标受众、最终成果数据等',
      visual: '统一字体与配色体系，增加留白和呼吸感，避免元素堆砌',
      structure: '建议增加目录页和章节过渡页，让阅读动线更清晰',
      info: '在每个项目中标注你的具体分工、使用工具和耗时',
      process: '补充草图、迭代稿、灵感板等过程资料，体现设计思维'
    };
    var keys = Object.keys(scores);
    keys.sort(function (a, b) { return scores[a] - scores[b]; });
    var weakDims = keys.filter(function (k) { return scores[k] < 80; }).slice(0, 3);
    weakDims.forEach(function (k) {
      var gap = 100 - scores[k];
      var impact = clamp(Math.round(gap / 10), 2, 9);
      issues.push({ title: dimName[k] + '有待加强（' + scores[k] + '分）', suggestion: dimSuggestion[k], impact: impact });
    });
    var noProcess = info.projects.filter(function (p) { return !p.hasProcess; });
    if (noProcess.length > 0 && scores.process < 75) {
      issues.push({ title: '缺少设计过程展示', suggestion: noProcess.length + '个项目未提供过程稿，建议补充草图、用户调研、方案迭代等内容，面试官非常看重思考过程', impact: 8 });
    }
    var noRole = info.projects.filter(function (p) { return !p.role || p.role === '未填写'; });
    if (noRole.length > 0) {
      issues.push({ title: '部分项目未说明个人分工', suggestion: '团队项目需明确标注你负责的部分，独立完成也请注明，让评审了解你的实际贡献', impact: 5 });
    }
    var shortDesc = info.projects.filter(function (p) { return (p.desc || '').length < 30; });
    if (shortDesc.length > 0) {
      issues.push({ title: '项目描述偏简略', suggestion: '建议每个项目描述不少于 100 字，讲清楚做了什么、为什么这么做、效果如何', impact: 6 });
    }
    return issues.slice(0, 5);
  }

  function genSummary(info, overall) {
    if (overall >= 90) return '这份作品集完成度很高，内容扎实、结构清晰，已达到优秀毕业作品集水准，投递和面试都很有竞争力。';
    if (overall >= 80) return '整体质量良好，核心要素齐全，针对下方建议稍作完善即可达到优秀水平。';
    if (overall >= 70) return '基础框架不错，但部分板块仍有提升空间，重点补充过程稿和项目细节后会有明显进步。';
    if (overall >= 60) return '作品集已具备雏形，但内容深度和完整度还需加强，建议按照下方建议逐项完善。';
    return '目前作品集还处于起步阶段，建议先补充完整项目内容，再逐步优化视觉和结构。';
  }

  function evaluate(portfolioText) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var info = parsePortfolio(portfolioText);
        var scores = {
          content: scoreContent(info),
          visual: scoreVisual(info),
          structure: scoreStructure(info),
          info: scoreInfo(info),
          process: scoreProcess(info)
        };
        var overall = Math.round((scores.content + scores.visual + scores.structure + scores.info + scores.process) / 5);
        resolve({
          overall: overall, scores: scores,
          strengths: genStrengths(info, scores),
          issues: genIssues(info, scores),
          summary: genSummary(info, overall)
        });
      }, THINK_DELAY);
    });
  }

  function ask(messages) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var userMsg = '';
        for (var i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'user') { userMsg = messages[i].content; break; }
        }
        resolve(generateReply(userMsg, messages));
      }, 800);
    });
  }

  function generateReply(question, messages) {
    var q = question || '';
    if (/先改|优先|哪个.*改|先做/.test(q)) {
      return '建议按以下优先级改进：\n\n1. 先补过程稿——这是面试官最看重的部分，也是最容易提分的点\n2. 再丰富项目描述——每个项目补充背景、目标、方法、成果四要素\n3. 最后优化视觉——统一字体、配色、间距\n\n按这个顺序改，效率最高、提分最快。';
    }
    if (/过程稿|草图|迭代/.test(q)) {
      return '补充过程稿可以从这几方面入手：\n\n1. 灵感板 / Moodboard：拼贴参考图，说明风格来源\n2. 草图方案：放 2-3 张早期手绘或低保真稿\n3. 迭代对比：展示从初稿到终稿的变化，说明为什么改\n4. 用户调研：如果有访谈或问卷，放上关键数据\n\n哪怕过程不完美，展示思考过程本身就比只放成品更有说服力。';
    }
    if (/面试|讲解|怎么讲|讲述/.test(q)) {
      return '面试讲解作品集建议用这个结构：\n\n1. 一句话概述：这是我为 XX 设计的 XX，目标是解决 XX 问题\n2. 背景与挑战：为什么做、遇到什么困难\n3. 你的角色：你具体负责什么、怎么做的\n4. 关键决策：展示 1-2 个你做的重要设计选择及理由\n5. 成果与反思：最终效果如何、学到了什么\n\n控制在 3-5 分钟，重点突出你的思考而不是软件操作。';
    }
    if (/分数|评分|几分|为什么/.test(q)) {
      return '评分是根据五个维度综合计算的：内容完整性、视觉表现力、结构清晰度、信息充分度、过程展示。每个维度根据你填写的内容详细度打分，最后取平均值。\n\n想提分的话，重点提升得分最低的维度，投入产出比最高。';
    }
    return '关于' + q + '，我的建议是：\n\n先对照测评报告中得分最低的维度，针对性地补充内容。作品集的核心竞争力在于真实的过程展示和清晰的个人贡献，把这两点做好，整体质量会有明显提升。\n\n如果需要更具体的建议，可以告诉我你具体卡在哪个环节。';
  }

  function systemContext(portfolioText, result) {
    return '你正在帮助一名毕业生改进他的作品集。以下是作品集信息与你的评审结果，请基于这些信息继续回答。\n\n' +
      '【作品集信息】\n' + portfolioText + '\n\n【评审结果】\n' + JSON.stringify(result);
  }

  window.JYAI = { evaluate: evaluate, ask: ask, systemContext: systemContext };
})();
