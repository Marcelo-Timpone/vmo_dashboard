import * as XLSX from 'xlsx';
import { SapProjectFinancial, AppStateData } from '../types';
import { formatCurrencyBRL } from './dateUtils';

/**
 * Exports project financial dataset to real Excel (.xlsx) file
 */
export function exportToExcel(projects: SapProjectFinancial[], filename: string = 'Relatorio_VMO_Exed_Consulting.xlsx') {
  const rows = projects.map(p => ({
    'Código Projeto': p.code,
    'Nome do Projeto': p.name,
    'Cliente': p.client,
    'Status': p.status || 'ATIVO',
    'Data Encerramento': p.closureDate || '',
    'Solução SAP': p.solution,
    'Orçado (R$)': p.budgetPlanned,
    'Realizado (R$)': p.budgetRealized,
    'Faturado (R$)': p.billed,
    'Total Gasto Reembolsável (R$)': p.reimbursableExpenseTotal ?? 0,
    'Possui CR em Aberto': p.hasOpenCr ? 'Sim' : 'Não',
    'Valor da CR (R$)': p.crValue ?? 0,
    'Desvio de Custo (%)': `${p.costVariancePercent}%`,
    'Margem Estimada (%)': `${p.marginPercent}%`,
    'Tag de Tráfego': p.trafficTag,
    'Data de Referência': p.referenceDate,
    'Pasta SharePoint': p.sharePointFolder,
    'Observações': p.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projetos SAP VMO');

  // Auto column widths
  const colWidths = [
    { wch: 15 },
    { wch: 35 },
    { wch: 25 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 26 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 45 },
    { wch: 30 }
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
}

/**
 * Exports projects to CSV
 */
export function exportToCsv(projects: SapProjectFinancial[], filename: string = 'Relatorio_VMO_Exed_Consulting.csv') {
  const headers = ['Código', 'Nome', 'Cliente', 'Status', 'Data Encerramento', 'Solução SAP', 'Orçado (R$)', 'Realizado (R$)', 'Faturado (R$)', 'Gasto Reembolsável (R$)', 'CR em Aberto', 'Valor CR (R$)', 'Desvio (%)', 'Margem (%)', 'Tráfego', 'Data Ref', 'SharePoint'];
  const rows = projects.map(p => [
    `"${p.code}"`,
    `"${p.name?.replace(/"/g, '""') || ''}"`,
    `"${p.client?.replace(/"/g, '""') || ''}"`,
    `"${p.status || 'ATIVO'}"`,
    `"${p.closureDate || ''}"`,
    `"${p.solution}"`,
    p.budgetPlanned,
    p.budgetRealized,
    p.billed,
    p.reimbursableExpenseTotal ?? 0,
    p.hasOpenCr ? '"Sim"' : '"Não"',
    p.crValue ?? 0,
    p.costVariancePercent,
    p.marginPercent,
    `"${p.trafficTag}"`,
    `"${p.referenceDate}"`,
    `"${p.sharePointFolder}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gera o nome padrão do arquivo JASON de exportação:
 * "DASHBOARD VMO EXED - [ANOMÊSDIA]" (ex: DASHBOARD VMO EXED - 20260909.json)
 */
export function getJsonExportFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `DASHBOARD VMO EXED - ${yyyy}${mm}${dd}.json`;
}

/**
 * Exports complete VMO Dashboard State & Settings to JSON
 * Saves all web app data: projects, clients (including logos), widgets,
 * container settings, sharepoint links, reference period, theme, and instructions.
 * Also keeps the 4 Supabase tables for keep-alive sync.
 */
export function exportStateToJson(
  state: AppStateData,
  users?: any[],
  filename?: string
) {
  const targetFilename = filename || getJsonExportFilename();
  const timestamp = new Date().toISOString();
  const instructionsText = state.instrucoesPreenchimento || '';
  
  // Format the 4 Supabase tables
  const defaultUsers = users || [
    { id: 'usr-pmo', username: 'pmo', role: 'pmo', name: 'Gestor VMO / PMO Corporativo', updated_at: timestamp },
    { id: 'usr-demo', username: 'demonstrativo', role: 'demonstrativo', name: 'Visualizador Executivo', updated_at: timestamp },
    { id: 'usr-fernando', username: 'fernando.costa', role: 'pmo', name: 'Fernando Costa (PMO Leader)', updated_at: timestamp },
    { id: 'usr-aline', username: 'aline.ribeiro', role: 'pmo', name: 'Aline Ribeiro (PMO Analytics)', updated_at: timestamp },
    { id: 'usr-yara', username: 'yara.oliveira', role: 'pmo', name: 'Yara Oliveira (PMO Governança)', updated_at: timestamp }
  ];

  const formattedWidgets = (state.widgets || []).map((w, idx) => ({
    id: w.id,
    title: w.title,
    type: w.type,
    order_num: w.order || idx + 1,
    visible: w.visible,
    collapsed: w.collapsed,
    filterSolutions: w.filterSolutions,
    filterTraffic: w.filterTraffic,
    updated_at: timestamp
  }));

  const formattedLinks = (state.sharePointLinks || []).map(l => ({
    id: l.id,
    label: l.label,
    url: l.url,
    is_primary: l.isPrimary,
    notes: l.notes,
    updated_at: timestamp
  }));

  const formattedDataReferencia = {
    id: 'active_vmo_period',
    start_date: state.referencePeriod.startDate,
    end_date: state.referencePeriod.endDate,
    current_date: state.referencePeriod.currentDate,
    updated_at: timestamp
  };

  const localDosDadosValue = state.local_dos_dados || state.localDosDados || '';

  // Structured with INSTRUCOES_PARA_PREENCHIMENTO as the first key so it appears right at the start
  const fullPayload = {
    INSTRUCOES_PARA_PREENCHIMENTO: instructionsText,
    instrucoes_para_preenchimento: instructionsText,
    local_dos_dados: localDosDadosValue,
    localDosDados: localDosDadosValue,
    metadata: {
      projeto: 'Exed Consulting - VMO Corporativo',
      versao: '3.0-integral',
      exportado_em: timestamp,
      descricao: 'Exportação de dados do WebApp (Projetos, Clientes e Logos, Contêineres, Gráficos, SharePoint, Migração e Período)'
    },
    dados_aplicacao: {
      instrucoes_preenchimento: instructionsText,
      local_dos_dados: localDosDadosValue,
      configuracoes_gerais: {
        tema: state.theme || 'neon',
        exportado_em: timestamp
      },
      configuracoes_conteineres: state.containerSettings,
      clientes_e_logos: state.clients || [],
      projetos: state.projects || [],
      graficos_dashboard: formattedWidgets,
      links_sharepoint: formattedLinks,
      periodo_referencia: formattedDataReferencia
    },
    // Compatibilidade com tabelas de persistência
    usuarios: defaultUsers,
    configuracao_graficos: formattedWidgets,
    links: formattedLinks,
    data_referencia: formattedDataReferencia,
    // Propriedades diretas no root para restauração rápida
    projects: state.projects || [],
    clients: state.clients || [],
    widgets: state.widgets || [],
    containerSettings: state.containerSettings,
    sharePointLinks: state.sharePointLinks || [],
    referencePeriod: {
      startDate: state.referencePeriod.startDate,
      endDate: state.referencePeriod.endDate,
      currentDate: state.referencePeriod.currentDate,
    },
    theme: state.theme
  };

  const jsonStr = JSON.stringify(fullPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', targetFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an Executive PowerPoint compatible Presentation (.ppt) file
 * formatted with corporate Exed visual identity (Blue #0B2240, Orange #F26522, White)
 */
export function exportToPpt(projects: SapProjectFinancial[], periodLabel: string) {
  const totalPlanned = projects.reduce((acc, p) => acc + p.budgetPlanned, 0);
  const totalRealized = projects.reduce((acc, p) => acc + p.budgetRealized, 0);
  const totalBilled = projects.reduce((acc, p) => acc + p.billed, 0);
  const avgMargin = projects.length ? (projects.reduce((acc, p) => acc + p.marginPercent, 0) / projects.length).toFixed(1) : '0';

  const solutions = ['Fábrica', 'RISE', 'GROW', 'SCP (IBP)', 'SCE'] as const;
  const solutionStats = solutions.map(sol => {
    const list = projects.filter(p => p.solution === sol);
    const planned = list.reduce((a, b) => a + b.budgetPlanned, 0);
    const realized = list.reduce((a, b) => a + b.budgetRealized, 0);
    return { sol, count: list.length, planned, realized };
  });

  // Create an HTML/MHTML formatted presentation file natively recognized by Microsoft PowerPoint and presentation viewers
  const pptHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:p="urn:schemas-microsoft-com:office:powerpoint"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>Exed Consulting - Relatório Executivo VMO Corporativo</title>
<style>
  body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background: #0B2240; color: #FFFFFF; }
  .slide { background: #FFFFFF; color: #0B2240; border-radius: 8px; padding: 40px; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); page-break-after: always; min-height: 520px; }
  .header { border-bottom: 3px solid #F26522; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .title { font-size: 26px; font-weight: bold; color: #0B2240; margin: 0; }
  .tag { background: #F26522; color: #FFFFFF; font-size: 12px; padding: 4px 10px; font-weight: bold; }
  .kpi-row { display: flex; gap: 15px; margin-bottom: 25px; }
  .kpi-box { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #0B2240; padding: 15px; }
  .kpi-box.orange { border-left-color: #F26522; }
  .kpi-label { font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: bold; }
  .kpi-value { font-size: 20px; font-weight: bold; color: #0B2240; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
  th { background: #0B2240; color: #FFFFFF; padding: 8px; text-align: left; }
  td { padding: 8px; border-bottom: 1px solid #E2E8F0; }
  .traffic-verde { color: #166534; font-weight: bold; }
  .traffic-amarelo { color: #854D0E; font-weight: bold; }
  .traffic-vermelho { color: #991B1B; font-weight: bold; }
  .traffic-cinza { color: #4B5563; font-weight: bold; }
  .footer { margin-top: 30px; font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px; }
</style>
</head>
<body>

  <!-- SLIDE 1: Capa Executiva -->
  <div class="slide" style="background: #0B2240; color: #FFFFFF; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
    <div style="font-size: 44px; font-weight: bold; letter-spacing: -1px; margin-bottom: 10px; color: #FFFFFF;">
      Exed Consulting
    </div>
    <div style="font-size: 24px; color: #F26522; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 25px;">
      VMO Corporativo | Relatório Executivo de Projetos SAP
    </div>
    <div style="font-size: 16px; color: #CBD5E1; max-width: 600px; margin-bottom: 40px;">
      Demonstrativo Financeiro e Status de Tráfego das Soluções Fábrica, RISE, GROW, SCP (IBP) e SCE
    </div>
    <div style="background: rgba(255,255,255,0.1); padding: 10px 24px; border: 1px solid #F26522; font-size: 13px;">
      Período de Referência: ${periodLabel}
    </div>
  </div>

  <!-- SLIDE 2: Resumo Financeiro Consolidado -->
  <div class="slide">
    <div class="header">
      <div>
        <div class="title">Resumo Financeiro Executivo</div>
        <div style="font-size: 12px; color: #64748B;">Período: ${periodLabel}</div>
      </div>
      <div class="tag">VMO Corporativo</div>
    </div>

    <div class="kpi-row">
      <div class="kpi-box">
        <div class="kpi-label">Orçamento Planejado</div>
        <div class="kpi-value">${formatCurrencyBRL(totalPlanned)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Total Realizado</div>
        <div class="kpi-value">${formatCurrencyBRL(totalRealized)}</div>
      </div>
      <div class="kpi-box orange">
        <div class="kpi-label">Faturamento Emitido</div>
        <div class="kpi-value" style="color: #F26522;">${formatCurrencyBRL(totalBilled)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Margem Bruta Média</div>
        <div class="kpi-value">${avgMargin}%</div>
      </div>
    </div>

    <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #0B2240;">Consolidação por Solução SAP:</div>
    <table>
      <thead>
        <tr>
          <th>Solução SAP</th>
          <th>Qtd Projetos</th>
          <th>Orçado Total</th>
          <th>Realizado Total</th>
          <th>Saldo Orçamentário</th>
        </tr>
      </thead>
      <tbody>
        ${solutionStats.map(s => `
          <tr>
            <td><strong>${s.sol}</strong></td>
            <td>${s.count}</td>
            <td>${formatCurrencyBRL(s.planned)}</td>
            <td>${formatCurrencyBRL(s.realized)}</td>
            <td>${formatCurrencyBRL(s.planned - s.realized)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      Exed Consulting - VMO Corporativo | Documento Gerado em ${new Date().toLocaleDateString('pt-BR')}
    </div>
  </div>

  <!-- SLIDE 3: Carteira de Projetos e Status de Tráfego -->
  <div class="slide">
    <div class="header">
      <div>
        <div class="title">Carteira de Projetos SAP e Tráfego</div>
        <div style="font-size: 12px; color: #64748B;">Foco Financeiro e Acompanhamento de Desvios</div>
      </div>
      <div class="tag">Exed Consulting</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Cliente</th>
          <th>Solução</th>
          <th>Orçado</th>
          <th>Realizado</th>
          <th>Desvio %</th>
          <th>Margem %</th>
          <th>Status Tráfego</th>
        </tr>
      </thead>
      <tbody>
        ${projects.map(p => `
          <tr>
            <td><strong>${p.code}</strong></td>
            <td>${p.client}</td>
            <td>${p.solution}</td>
            <td>${formatCurrencyBRL(p.budgetPlanned)}</td>
            <td>${formatCurrencyBRL(p.budgetRealized)}</td>
            <td>${p.costVariancePercent >= 0 ? '+' : ''}${p.costVariancePercent}%</td>
            <td>${p.marginPercent}%</td>
            <td class="traffic-${p.trafficTag?.toLowerCase() || 'cinza'}">${p.trafficTag?.toUpperCase() || 'N/D'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      Exed Consulting - VMO Corporativo | Pasta SharePoint Oficial Integrada
    </div>
  </div>

</body>
</html>
  `;

  const blob = new Blob([pptHtml], { type: 'application/vnd.ms-powerpoint;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Apresentacao_Executiva_VMO_Exed.ppt');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers clean PDF print dialog
 */
export function exportToPdf() {
  window.print();
}
