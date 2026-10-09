import { motion } from 'motion/react';
import styles from './DataTable.module.css';

export function DataTable({ columns, rows, highlightRowIndex = null }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={styles.th}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={row.key ?? i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={i === highlightRowIndex ? styles.highlight : ''}
            >
              {columns.map((c) => (
                <td key={c.key} className={styles.td}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
