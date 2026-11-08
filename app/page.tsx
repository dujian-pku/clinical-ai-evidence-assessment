'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, FileText, FolderOpen, LoaderCircle, RotateCcw, Save } from 'lucide-react';
import { type Assessment, type Report, RULE_VERSION, calculate, decodeAssessment, dimensions, emptyAssessment, factualReport, metrics, outcomes, scenes, scoreNotes, statuses, users, validate } from '../lib/assessment';
import { exampleSource, researchExample, researchExamples, sourceCitation } from '../lib/research-examples';
import { reportReferences } from '../lib/report';
import { DEFAULT_DEMO_STUDY, DEMO_DELAY_MS, DEMO_REPORT_MODE, preGeneratedReport } from '../lib/demo-reports';

const storageKey = 'clinical-ai-assessment-v1';
function reportText(text: string) {
  return text.split(/(\d+(?:\.\d+)?\s*\/\s*5)/g).map((part, i) => /^\d+(?:\.\d+)?\s*\/\s*5$/.test(part) ? <span key={i} className="score-inline">{part}</span> : part);
}
function highlightedReportText(text: string, highlights: string[]) {
  const ranges = highlights.map(value => ({ start: text.indexOf(value), text: value })).filter(r => r.start >= 0).sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    parts.push(<span key={`text-${cursor}`}>{reportText(text.slice(cursor, range.start))}</span>);
    parts.push(<mark className="report-highlight" key={`mark-${range.start}`}>{reportText(range.text)}</mark>);
    cursor = range.start + range.text.length;
  }
  parts.push(<span key={`text-${cursor}`}>{reportText(text.slice(cursor))}</span>);
  return parts;
}
export default function Home() {
  const [data, setData] = useState<Assessment>(() => researchExample(DEFAULT_DEMO_STUDY));
  const [report, setReport] = useState<Report | null>(null);
  const [reportMode, setReportMode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [resetting, setResetting] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [createdAt, setCreatedAt] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const revision = useRef(0);
  const generationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (generationTimer.current !== null) clearTimeout(generationTimer.current);
  }, []);
  const reportRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const examplesRef = useRef<HTMLDetailsElement>(null);
  const score = calculate(data);
  const source = exampleSource(data);
  const baseFilled = [data.studyId, data.aiType, data.scene, data.user, data.disease].filter(x => x.trim()).length;
  const metricReady = data.metric === '未报告' ? !data.metricValue.trim() : metrics.includes(data.metric as typeof metrics[number]) && score.numeric !== null;
  const effectFilled = Number(!!data.overall) + Number(!!data.patient) + Number(metricReady);
  const steps = [
    { id: 'background', title: '研究信息', filled: baseFilled, total: 5 },
    { id: 'evidence', title: '证据报告', filled: 7 - score.unanswered.length, total: 7 },
    { id: 'performance', title: '模型效果', filled: effectFilled, total: 3 },
  ];
  const completed = steps.reduce((sum, step) => sum + step.filled, 0);
  function goStep(step: number, scroll = false) {
    setActiveStep(step);
    if (scroll) setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }
  function presentErrors(issues: string[]) {
    setErrors(issues);
    goStep(baseFilled < 5 ? 0 : score.unanswered.length ? 1 : 2, true);
  }
  function change(next: Assessment) {
    revision.current++;
    if (generationTimer.current !== null) clearTimeout(generationTimer.current);
    generationTimer.current = null;
    setPending(false);
    setData(next); setReport(null); setReportMode(''); setErrors([]); setMessage(''); setResetting(false);
  }
  function field(key: keyof Omit<Assessment, 'states'>, value: string) { change({ ...data, [key]: value }); }
  function loadExample(id: string) {
    change(researchExample(id)); setActiveStep(0);
    if (examplesRef.current) examplesRef.current.open = false;
  }
  function clear() { change(emptyAssessment()); setActiveStep(0); }
  function showReport(value: Report, mode: string) {
    setReport(value); setReportMode(mode);
    setCreatedAt(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
  function generate() {
    if (pending) return;
    const issues = validate(data);
    if (issues.length) { presentErrors(issues); return; }
    const prepared = preGeneratedReport(data);
    if (!prepared) {
      setErrors(['请重新载入一项研究示例，查看对应的演示报告。']);
      if (examplesRef.current) {
        examplesRef.current.open = true;
        examplesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    const current = revision.current;
    setPending(true); setErrors([]); setMessage('');
    setReport(null); setReportMode('');
    generationTimer.current = setTimeout(() => {
      generationTimer.current = null;
      if (current !== revision.current) return;
      setPending(false);
      showReport(prepared, DEMO_REPORT_MODE);
    }, DEMO_DELAY_MS);
  }
  function localReport() {
    const issues = validate(data);
    if (issues.length) { presentErrors(issues); return; }
    showReport(factualReport(data), '简版报告');
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); setMessage('草稿已保存。'); } catch { setMessage('浏览器未允许保存草稿。'); }
  }
  function restore() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) { setMessage('暂无已保存的草稿。'); return; }
      const parsed = decodeAssessment(JSON.parse(saved));
      if (!parsed) throw new Error();
      change(parsed); setActiveStep(0); setMessage('草稿已载入。');
    } catch { setMessage('未能读取草稿，请检查保存记录。'); }
  }
  function download() {
    if (!report) return;
    const content = '医学 AI 研究快速评估报告\n' + (reportMode === DEMO_REPORT_MODE ? '展示时间：' : '生成时间：') + createdAt + '（北京时间）\n规则版本：' + RULE_VERSION + '\n报告类型：' + reportMode + '\n' + (data.demo ? '【虚构演示数据】\n' : '') + '\n' + report.paragraphs.join('\n\n') + '\n\n证据完整性：' + score.evidence?.toFixed(2) + ' / 5；模型效果：' + score.effect?.toFixed(2) + ' / 5。\n' + scoreNotes(data) + '\n\n【填写记录】\n' + dimensions.map(d => d.name + '：' + data.states[d.key] + '；权重 ' + d.weight + '；得分 ' + (data.states[d.key] === '已报告' ? d.weight : 0)).join('\n') + '\n\n【研究者补充说明】\n' + (data.notes || '未填写');
    const citedContent = content + (source ? '\n\n【研究来源】\n' + sourceCitation(data) : '') + '\n\n【评价方法参考】\n' + reportReferences.map(reference => reference.title + '：' + reference.url).join('\n');
    const url = URL.createObjectURL(new Blob([citedContent], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'AI研究快速评估报告.txt'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="page-shell">
    <header className="topbar">
      <div className="institution-logos" aria-label="机构标识">
        <a className="institution-logo institution-pku" href="https://www.pku.edu.cn/" target="_blank" rel="noreferrer"><img src={`${import.meta.env.BASE_URL}assets/branding/pku.png`} width="852" height="240" alt="北京大学" /></a>
        <a className="institution-logo institution-pkuhsc" href="https://www.bjmu.edu.cn/" target="_blank" rel="noreferrer"><img src={`${import.meta.env.BASE_URL}assets/branding/pku-health-science-center.svg`} width="263" height="44" alt="北京大学医学部" /></a>
        <a className="institution-logo institution-nihds" href="https://www.nihds.pku.edu.cn/" target="_blank" rel="noreferrer"><img src={`${import.meta.env.BASE_URL}assets/branding/nihds.png`} width="647" height="83" alt="北京大学健康医疗大数据国家研究院" /></a>
      </div>
      <nav className="topnav" aria-label="主导航">
        <a href="#assessment" className="nav-current">研究评估</a>
        <a href="#method" onClick={() => setRulesOpen(true)}>评分方法</a>
        {report && <a href="#report">评估报告</a>}
      </nav>
    </header>
    <main className="workspace">
      <section className="page-heading">
        <div><p className="eyebrow">RESEARCH ASSESSMENT</p><h1>医学 AI 研究快速评估</h1><p className="lead">录入研究证据，查看评分与评估报告。</p></div>
        <div className="scope-label"><span className="scope-dot"/>临床决策辅助</div>
      </section>

      <div className="columns" id="assessment">
        <div className="form-column">
          <div className="editor-tools">
            <details className="examples-picker" ref={examplesRef}>
              <summary><BookOpen size={19}/> 载入研究示例 <ChevronDown size={17}/></summary>
              <div className="example-menu"><p>已发表研究</p>{researchExamples.map(item => <button key={item.id} aria-label={item.label} onClick={() => loadExample(item.id)}><span><strong>{item.title}</strong><small>{item.journal}</small></span></button>)}</div>
            </details>
            <div className="draft-actions">
              <button onClick={restore}><FolderOpen size={18}/> 读取草稿</button>
              <button onClick={save}><Save size={18}/> 保存本机</button>
              <button className="reset-button" aria-label="清空当前填写" onClick={() => setResetting(!resetting)}><RotateCcw size={17}/><span>清空</span></button>
            </div>
          </div>
          {resetting && <div className="notice">清空当前填写内容？<button onClick={clear}>确认清空</button><button onClick={() => setResetting(false)}>取消</button></div>}
          {message && <div role="status" className="notice"><Check size={17}/>{message}</div>}
          {data.demo && <div className="demo-banner">【虚构示例 {data.demo.toUpperCase()}】<button onClick={clear}>新建研究</button></div>}
          {source && <section className="study-source" aria-label="研究示例来源">
            <div className="source-heading"><div><p className="source-meta">{source.journal}{source.changed && <span className="edited-tag">已修改</span>}</p><h2>{source.title}</h2></div><a href={source.url} target="_blank" rel="noreferrer">查看论文</a></div>
            <details><summary>研究概况与填表依据 <ChevronDown size={16}/></summary><p>{source.summary}</p><p>{source.scope}</p><a href={source.pubmed} target="_blank" rel="noreferrer">PMID:{source.id} · 证据库第 {source.record} 项</a></details>
          </section>}

          <div className="editor-card" ref={editorRef}>
            <div className="step-nav" role="tablist" aria-label="填写步骤">
              {steps.map((step, i) => <button key={step.id} type="button" role="tab" id={'tab-' + step.id} aria-controls={step.id} aria-selected={activeStep === i} tabIndex={activeStep === i ? 0 : -1} onClick={() => goStep(i)} onKeyDown={event => {
                let next = i;
                if (event.key === 'ArrowRight') next = (i + 1) % 3;
                else if (event.key === 'ArrowLeft') next = (i + 2) % 3;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = 2;
                else return;
                event.preventDefault(); goStep(next);
                document.getElementById('tab-' + steps[next].id)?.focus();
              }}>
                <span className={'step-index' + (step.filled === step.total ? ' step-complete' : '')}>{step.filled === step.total ? <Check size={18}/> : '0' + (i + 1)}</span>
                <span className="step-label">{step.title}<small>{step.filled === step.total ? '已填写' : step.filled + ' / ' + step.total + ' 项'}</small></span>
              </button>)}
            </div>

            <section className="panel" id="background" role="tabpanel" aria-labelledby="tab-background" hidden={activeStep !== 0}>
              <div className="section-title"><div><h2>研究基本信息</h2><p>明确技术类型、疾病领域和应用场景。</p></div><span className="section-code">01 / 03</span></div>
              <div className="field-grid">
                <label className="field wide">研究 / 注册编号 <input value={data.studyId} maxLength={200} placeholder="PMID、注册号或自定义研究编号" onChange={e => field('studyId', e.target.value)}/></label>
                <label className="field">AI 类型 <input value={data.aiType} maxLength={200} placeholder="如：大语言模型、机器学习" onChange={e => field('aiType', e.target.value)}/></label>
                <label className="field">疾病领域 <input value={data.disease} maxLength={200} placeholder="如：肺癌、糖尿病或通用型" onChange={e => field('disease', e.target.value)}/></label>
                <label className="field">具体任务 <select value={data.scene} onChange={e => field('scene', e.target.value)}><option value="">请选择具体任务</option>{scenes.map(x => <option key={x}>{x}</option>)}</select></label>
                <label className="field">使用者 <select value={data.user} onChange={e => field('user', e.target.value)}><option value="">请选择使用者</option>{users.map(x => <option key={x}>{x}</option>)}</select></label>
              </div>
            </section>

            <section className="panel" id="evidence" role="tabpanel" aria-labelledby="tab-evidence" hidden={activeStep !== 1}>
              <div className="section-title"><div><h2>证据报告情况</h2><p>逐项选择七个维度的报告状态。</p></div><span className="section-code">02 / 03</span></div>
              <div className="dimension-list">{dimensions.map((d, i) => <div className="dimension" key={d.key}><div className="dimension-info"><div className="dimension-name"><span className="dimension-index">{'0' + (i + 1)}</span><strong>{d.name}</strong><span className="weight">{d.weight.toFixed(2)} 分</span></div><p>{d.description}</p></div><div className="status-options" role="group" aria-label={d.name + '报告状态'}>{statuses.map(s => <button type="button" key={s} aria-pressed={data.states[d.key] === s} onClick={() => change({ ...data, states: { ...data.states, [d.key]: s } })} className={data.states[d.key] === s ? 'selected ' + (s === '已报告' ? 'reported' : s === '未报告' ? 'missing' : 'na') : ''}>{s}</button>)}</div></div>)}</div>
              <p className="footnote">已报告项按权重计分，满分 5 分。</p>
            </section>

            <section className="panel" id="performance" role="tabpanel" aria-labelledby="tab-performance" hidden={activeStep !== 2}>
              <div className="section-title"><div><h2>模型效果</h2><p>填写评价结果与一项主要性能指标。</p></div><span className="section-code">03 / 03</span></div>
              <div className="field-grid">
                <label className="field">综合评价 <select value={data.overall} onChange={e => field('overall', e.target.value)}><option value="">请选择评价结果</option>{outcomes.map(x => <option key={x}>{x}</option>)}</select></label>
                <label className="field">患者报告结局 <select value={data.patient} onChange={e => field('patient', e.target.value)}><option value="">请选择结局情况</option>{outcomes.map(x => <option key={x}>{x}</option>)}</select></label>
                <label className="field">主要性能指标 <select value={data.metric} onChange={e => change({ ...data, metric: e.target.value, metricValue: e.target.value === '未报告' ? '' : data.metricValue })}><option value="">请选择一项主要指标</option>{metrics.map(x => <option key={x}>{x}</option>)}</select></label>
                <label className="field">性能数值 <input value={data.metricValue} maxLength={20} disabled={!data.metric || data.metric === '未报告'} placeholder={data.metric === '未报告' ? '未报告，不填写' : '如：0.85 或 85%'} onChange={e => field('metricValue', e.target.value)}/><small>输入 0–1，或带 % 的百分比</small></label>
              </div>
              <label className="field notes"><span className="notes-label">补充说明 <small>选填</small></span><textarea value={data.notes} maxLength={2000} rows={3} placeholder="比较对象、主要结果或其他说明" onChange={e => field('notes', e.target.value)}/></label>
            </section>

            <div className="step-footer">
              <span className="step-hint">{steps[activeStep].filled === steps[activeStep].total ? <><Check size={17}/> 本节已填写完整</> : <>本节已填写 {steps[activeStep].filled} / {steps[activeStep].total} 项</>}</span>
              <div>{activeStep > 0 && <button className="previous-step" onClick={() => goStep(activeStep - 1, true)}><ArrowLeft size={17}/> 上一步</button>}{activeStep < 2 ? <button className="next-step" onClick={() => goStep(activeStep + 1, true)}>下一步 <ArrowRight size={18}/></button> : <a className="next-step" href="#evaluation">查看评分 <ArrowRight size={18}/></a>}</div>
            </div>
          </div>

          <section className="method-panel" id="method"><button className="method-toggle" aria-expanded={rulesOpen} aria-controls="method-content" onClick={() => setRulesOpen(!rulesOpen)}><span><FileText size={19}/> 评分方法</span><span className="method-meta"><ChevronDown className={rulesOpen ? 'rotated' : ''} size={18}/></span></button>{rulesOpen && <div className="method-content" id="method-content">
            <p>【适用场景】临床决策辅助。权重来自 12 位专家对该场景的评价。</p>
            <p>【证据完整性】将七个维度中已报告项的权重相加。未报告和不适用均计 0 分，满分为 5 分。安全性若选不适用，最高可得 3.20 分。</p>
            <p>【模型效果】（综合评价分＋主要性能数值×5＋患者报告结局分）÷3。综合评价与患者报告结局：改善 5 分、等效 3 分、劣势 0 分、未报告 3 分。性能未报告计 0 分，仍按三项平均。</p>
            <p>【结果判定】改善须有适当对照，且达到预设的有意义改善；等效须有预设等效界值及相应区间支持。未报告与等效分值相同，含义不同。性能指标预先选定一项。</p>
            <p>【评分含义】完整性分数表示报告覆盖程度，模型效果分数汇总填写的结果。两项分别呈现。</p>
            <p className="muted">规则版本：{RULE_VERSION}</p>
          </div>}</section>
        </div>

        <aside className="results-column" id="evaluation" aria-label="评估概览">
          <div className="result-panel">
            <div className="result-heading"><h2>评估概览</h2><span><span className="live-dot"/> 实时更新</span></div>
            <div className="progress-block"><div><span>填写进度</span><strong>{completed} <span>/ 15 项</span></strong></div><div className="progress-track" role="progressbar" aria-label="填写进度" aria-valuemin={0} aria-valuemax={15} aria-valuenow={completed}><span style={{width: (completed / 15 * 100) + '%'}}/></div></div>
            <div className="score-pair">
              <div className="score-block"><p>证据完整性</p><div className="score-number">{score.evidence === null ? '—' : score.evidence.toFixed(2)}<span>/ 5</span></div><div className="score-track"><div style={{ width: ((score.evidence ?? 0) * 20) + '%' }}/></div><p className="score-caption">{score.evidence === null ? '待填写' : score.reported.length + ' / 7 项已报告'}</p></div>
              <div className="score-block effect-score"><p>模型效果</p><div className="score-number">{score.effect === null ? '—' : score.effect.toFixed(2)}<span>/ 5</span></div><div className="score-track"><div style={{ width: ((score.effect ?? 0) * 20) + '%' }}/></div><p className="score-caption">{score.effect === null ? '待填写' : '三项结果平均'}</p></div>
            </div>
            <details className="coverage" open><summary>维度得分 <ChevronDown size={17}/></summary><div>{dimensions.map(d => <div className="coverage-row" key={d.key}><span className={'coverage-dot ' + (data.states[d.key] === '已报告' ? 'is-reported' : data.states[d.key] ? 'is-filled' : '')}/><span>{d.name}</span><span>{data.states[d.key] ? data.states[d.key] === '已报告' ? d.weight.toFixed(2) : '0.00' : '—'}</span></div>)}</div></details>
            <div className="generate-area">
              <button className="primary" onClick={generate} disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle className="spin" size={19}/> : <FileText size={19}/>} {pending ? '正在生成报告…' : '生成评估报告'}</button>
              <button className="secondary-report" onClick={localReport} disabled={pending}>生成简版报告</button>
              <p className="data-note" role="status">{pending ? '演示加载中，约 5 秒后展示。' : '演示模式 · 报告由 DeepSeek 预先生成。'}</p>
              {errors.length > 0 && <div role="alert" className="errors"><p>{errors[0]}</p>{errors.length > 1 && <details><summary>另有 {errors.length - 1} 项待填写</summary>{errors.slice(1).map((error, i) => <p key={i}>{error}</p>)}</details>}</div>}
            </div>
          </div>
          {report && <a className="report-shortcut" href="#report"><Check size={18}/><span>报告已生成<small>查看本次评估报告</small></span><ArrowRight size={19}/></a>}
        </aside>
      </div>

      {report && <section className="report-panel" ref={reportRef} id="report">
        <div className="report-header"><div><p className="eyebrow">ASSESSMENT REPORT</p><h2>快速评估报告</h2><p>{reportMode} · {reportMode === DEMO_REPORT_MODE ? '展示时间：' : ''}{createdAt}（北京时间）</p></div><button onClick={download}><ArrowDownToLine size={19}/> 导出 TXT</button></div>
        {data.demo && <p className="demo-report">【虚构演示数据】</p>}
        <div className="report-metrics"><span>证据完整性 <strong>{score.evidence?.toFixed(2)} <small>/ 5</small></strong></span><span>模型效果 <strong>{score.effect?.toFixed(2)} <small>/ 5</small></strong></span></div>
        <div className="report-body">{report.paragraphs.map((paragraph, i) => <p key={i}>{highlightedReportText(paragraph, (report.highlights || []).filter(h => h.paragraph === i).map(h => h.text))}</p>)}</div>
        <details className="report-method"><summary>评分说明与评价方法 <ChevronDown size={16}/></summary><p>{scoreNotes(data) || '两项分数分别反映本次填报的报告覆盖情况与模型效果，按临床决策辅助评分表计算。'}</p><p>评述参考研究报告方法，计分沿用项目原表。</p><div>{reportReferences.map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>)}</div></details>
        {source && <div className="report-source"><p>示例来源：<a href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.journal}</a>{source.changed ? '（当前填写已修改）' : ''}</p></div>}
      </section>}

      <footer className="footer"><span>医学 AI 研究快速评估</span><span>临床决策辅助</span></footer>
    </main>
  </div>;
}
