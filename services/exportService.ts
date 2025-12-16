
/**
 * 将数据导出为 CSV 文件
 * @param data 要导出的数组数据
 * @param headers 键值对，key 为数据字段名，value 为导出时的列名
 * @param filename 文件名（不含后缀）
 */
export const exportToCSV = (data: any[], headers: Record<string, string>, filename: string) => {
  const headerKeys = Object.keys(headers);
  const headerLabels = Object.values(headers);
  
  const csvRows = [
    headerLabels.join(','), // 表头行
    ...data.map(row => 
      headerKeys.map(key => {
        const val = row[key] === undefined || row[key] === null ? '' : row[key];
        // 转换成字符串并处理双引号，转义 CSV 中的特殊字符
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ];
  
  // 添加 UTF-8 BOM (\ufeff)，确保 Excel 正确识别中文编码
  const blob = new Blob(["\ufeff" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
