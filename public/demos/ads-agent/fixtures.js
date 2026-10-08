'use strict';

window.ADS_DEMO_RUNS = [
  {
    id: 'demo-2026-10-03-stable',
    report_date: '2026-10-03',
    model: '演示模型 · 基线',
    status: 'pass',
    model_calls: 18,
    summary: {
      time_range: '30 天 · 2026-09-04 至 2026-10-03',
      metrics: {spend: 1234.56, impressions: 10000, clicks: 345, leads: 12, cpl: 102.88, ctr: 0.0345, cvr: 0.0348},
    },
    review: {
      operational_status: 'pass',
      agent_coverage: {supervisor: true, data_analysis: true, ads_diagnosis: true, content_review: true, strategy: true},
      issues: [],
    },
    report: `# 投放诊断日报｜演示数据\n\n【账户总体】\n本次演示的账户运行平稳，消耗 1234.56，展示 10000，点击 345，线索 12，CPL 102.88，CTR 3.45%，CVR 3.48%。Agent 职责链路全部完成，交付稳定，建议按既定节奏继续观察。\n\n【待处理计划】\n- 计划甲：各项数据处于预期范围。\n- 计划乙：成本稳定，继续积累样本。\n- 计划丙：留资表现符合近期基线。\n- 计划丁：状态正常，无需额外操作。\n- 计划戊：按日常节奏复查。\n\n【问题更可能在哪】\n当前样本未显示需要升级处理的问题，账户、计划和素材层级的数据方向一致。\n\n【今天具体做什么】\n- 维持当前设置，继续记录账户表现。\n- 按计划复核下一观察窗口的数据。\n\n【下一次看什么】\n- 对比后续窗口的消耗、线索和 CPL。\n`,
  },
  {
    id: 'demo-2026-10-02-coverage',
    report_date: '2026-10-02',
    model: '演示模型 · 数据复核',
    status: 'partial',
    model_calls: 16,
    summary: {
      time_range: '7 天 · 2026-09-26 至 2026-10-02',
      metrics: {spend: 8420, impressions: 62400, clicks: 210, leads: 8, cpl: 1052.5, ctr: 0.0034, cvr: 0.0381},
    },
    review: {
      operational_status: 'partial',
      agent_coverage: {supervisor: true, data_analysis: true, ads_diagnosis: true, content_review: false, strategy: true},
      issues: ['数据覆盖不足：近 7 天计划明细缺失，暂不能归因到具体计划。'],
    },
    report: `# 投放诊断日报｜演示数据\n\n【账户总体】\n本次演示数据消耗 8420.00，展示 62400，点击 210，线索 8，CPL 1052.50，CTR 0.34%，CVR 3.81%。账户汇总可读，但计划明细覆盖不足，当前结论需要人工复核。\n\n【数据发现】\n- 账户汇总指标完整，7 天消耗与线索可用于总量观察。\n- 多个计划缺少近期日明细，计划维度的比较证据不足。\n- 内容审核 Agent 未完成，素材归因仍待补充。\n- 缺失数据不能直接解释为计划暂停或表现为零。\n- 质量反馈与成交结果未提供，不能据此判断有效获客成本。\n\n【证据不足项】\n- 计划级日报缺少近期明细，无法复核单计划成本变化。\n- 素材与计划映射未完成，不能将素材变化归因到具体计划。\n- 成交与线索质量数据未提供，无法判断有效获客成本。\n- 内容审核未完成，素材层面的结论需要人工复核。\n- 缺失日期范围尚未和原始报表再次交叉核对。\n\n【问题更可能在哪】\n目前可确认的是数据覆盖缺口，尚不能区分计划层表现变化与记录不完整。应先补齐证据再做归因。\n\n【今天具体做什么】\n- 补齐计划明细并核对报告日期范围。\n- 完成素材与计划的对应关系复核。\n\n【下一次看什么】\n- 复核数据覆盖状态和计划级 CPL。\n`,
  },
  {
    id: 'demo-2026-10-01-material',
    report_date: '2026-10-01',
    model: '演示模型 · 素材诊断',
    status: 'fail',
    model_calls: 14,
    summary: {
      time_range: '7 天 · 2026-09-25 至 2026-10-01',
      metrics: {spend: 2760.5, impressions: 28600, clicks: 154, leads: 6, cpl: 460.08, ctr: 0.0054, cvr: 0.039},
    },
    review: {
      operational_status: 'fail',
      agent_coverage: {supervisor: true, data_analysis: true, ads_diagnosis: true, content_review: true, strategy: false},
      issues: ['素材甲有消耗但暂无留资，需结合样本量人工复核。', '策略 Agent 未完成，建议暂缓自动化动作。'],
    },
    report: `# 投放诊断日报｜演示数据\n\n【账户总体】\n本次演示数据消耗 2760.50，展示 28600，点击 154，线索 6，CPL 460.08，CTR 0.54%，CVR 3.90%。素材甲有消耗但暂无留资，这是待核对的异常信号；单凭当前样本不能直接判定素材质量。\n\n【待处理计划】\n- 计划甲：近期消耗持续，留资表现低于账户演示基线。\n- 计划乙：数据量有限，保持观察。\n\n【问题更可能在哪】\n异常集中在点击后的留资环节，但样本量有限，且策略环节尚未完成复核，当前只能标记为待查线索。\n\n【今天具体做什么】\n- 核查素材甲对应的计划和落地承接。\n- 补足观察样本后再评估是否调整。\n\n【下一次看什么】\n- 查看素材级留资变化及对应计划表现。\n`,
  },
];
