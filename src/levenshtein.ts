// Levenshtein距离算法实现

/**
 * 计算两个字符串之间的Levenshtein距离
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns 两个字符串之间的编辑距离
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // 初始化矩阵的第一行
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // 初始化矩阵的第一列
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // 填充矩阵
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 删除
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 计算两个字符串的相似度（0-1之间，1表示完全相同）
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns 相似度值
 */
export function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  
  // 避免除以零
  if (maxLength === 0) return 1;
  
  return 1 - distance / maxLength;
}