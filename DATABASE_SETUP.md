# 数据库结构配置指南

本文档说明如何在 PocketBase 中配置新增的数据表结构。

## 📋 需要创建的 Collection

### 1. `presentation_suggestions` - 汇报建议记录

#### 字段配置

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `weekStartDate` | Text | ✅ | 周期开始日期（周一日期，格式：yyyy-MM-dd） |
| `style` | Text | ✅ | 汇报风格（formal/casual/detailed/concise/data-driven/story-driven） |
| `outline` | JSON | ✅ | 汇报大纲数组 |
| `talkingPoints` | JSON | ✅ | 详细话术数组 |
| `qa` | JSON | ✅ | Q&A 数组 |
| `duration` | Text | ✅ | 建议汇报时长 |
| `created` | DateTime | ✅ | 创建时间（自动） |
| `updated` | DateTime | ✅ | 更新时间（自动） |

#### 创建步骤

1. **登录 PocketBase Admin UI**
   - 访问：`http://你的服务器地址/_/`
   - 使用管理员账号登录

2. **创建 Collection**
   - 点击左侧菜单 "Collections"
   - 点击 "New Collection" 按钮
   - Collection ID: `presentation_suggestions`
   - Collection Name: `汇报建议记录`

3. **添加字段**

   按照上表逐个添加字段：

   **weekStartDate**
   - Type: Text
   - Name: weekStartDate
   - Required: ✅
   - Max length: 10

   **style**
   - Type: Text
   - Name: style
   - Required: ✅
   - Max length: 20

   **outline**
   - Type: JSON
   - Name: outline
   - Required: ✅

   **talkingPoints**
   - Type: JSON
   - Name: talkingPoints
   - Required: ✅

   **qa**
   - Type: JSON
   - Name: qa
   - Required: ✅

   **duration**
   - Type: Text
   - Name: duration
   - Required: ✅
   - Max length: 20

   **created** 和 **updated**
   - 这两个字段在创建 Collection 时会自动添加，无需手动创建

4. **设置权限（重要）**

   点击 "API Rules" 标签页，设置访问权限：

   **List/Search Rule:**
   ```
   @request.auth.id != ""
   ```
   说明：已登录用户可以查看自己的记录

   **View Rule:**
   ```
   @request.auth.id != ""
   ```
   说明：已登录用户可以查看记录

   **Create Rule:**
   ```
   @request.auth.id != ""
   ```
   说明：已登录用户可以创建记录

   **Update Rule:**
   ```
   @request.auth.id != ""
   ```
   说明：已登录用户可以更新记录

   **Delete Rule:**
   ```
   @request.auth.id != ""
   ```
   说明：已登录用户可以删除记录

5. **设置索引（可选，但推荐）**

   为了提高查询性能，建议添加以下索引：

   - `weekStartDate` + `style` (复合索引)
   - `created` (单字段索引)

   创建索引步骤：
   - 点击字段右侧的 "..." 菜单
   - 选择 "Create index"

6. **保存设置**
   - 点击右上角 "Save" 按钮

---

## 🔍 验证配置

### 方法 1: 通过 Admin UI 验证

1. 在 Collections 列表中找到 `presentation_suggestions`
2. 点击进入，查看字段是否正确
3. 尝试手动创建一条测试记录

### 方法 2: 通过应用验证

1. 启动应用
2. 以 Manager 身份登录
3. 进入工作台账页面
4. 生成汇报建议
5. 检查是否成功保存

---

## 🛠️ 使用 SQL 快速创建（高级）

如果你熟悉 SQL，也可以使用 PocketBase 的 SQL 功能快速创建：

```sql
-- 注意：PocketBase 使用自己的 SQL 语法，以下仅供参考
-- 实际创建建议通过 Admin UI 完成
```

---

## 📝 JSON 字段示例

### outline 字段示例
```json
["本周工作概览", "重点项目进展", "团队协作情况", "下周计划"]
```

### talkingPoints 字段示例
```json
[
  {
    "title": "本周工作概览",
    "script": "本周团队整体工作进展顺利，累计完成XX工时。",
    "data": "总工时XX小时，参与人员X人"
  }
]
```

### qa 字段示例
```json
[
  {
    "question": "项目A的进展如何？",
    "answer": "项目A已进入关键阶段，预计下周完成。"
  }
]
```

---

## ⚠️ 注意事项

1. **字段类型必须正确**：`outline`、`talkingPoints`、`qa` 必须是 JSON 类型，不能是 Text
2. **权限设置**：确保已登录用户可以访问，否则前端无法保存数据
3. **索引优化**：如果数据量大，建议添加索引提高查询性能
4. **数据迁移**：如果已有数据，需要先备份再修改结构

---

## 🔄 更新现有 Collection

如果 Collection 已存在但字段不完整：

1. 进入 Collection 设置
2. 添加缺失的字段
3. 确保字段类型和必填设置正确
4. 保存更改

---

## ❓ 常见问题

### Q: 为什么保存失败，提示权限不足？

A: 检查 API Rules 中的 Create/Update 规则，确保已登录用户可以操作。

### Q: JSON 字段保存后显示为字符串？

A: 确保字段类型设置为 JSON，不是 Text。

### Q: 如何查看已保存的汇报建议？

A: 在 PocketBase Admin UI 中，进入 `presentation_suggestions` Collection，可以查看所有记录。

---

## 📚 相关文档

- [PocketBase 官方文档](https://pocketbase.io/docs/)
- [Collection 配置指南](https://pocketbase.io/docs/collections/)
