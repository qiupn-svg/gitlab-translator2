import fetch from 'node-fetch';

// 1. 你的 GitLab Webhook Secret Token 
// 已根据你的要求，将密钥直接写入代码中。
const GITLAB_SECRET_TOKEN = 'aoisdj-123nkad-98asd-bkasd9';

// 2. 你的产品工作流的目标 URL (固定值)
const TARGET_WEBHOOK_URL = 'https://insight-api.airdroid.com/api/v1/workflow/exe/k1BJTv6MYL8104PXr9GWRIJJSBTcj341187CXRT5nZRoC27bRT_emMU6CNqJgo0pHNZutpccMfn9gC9tAyXL6w';


export default async function handler(req, res) {
  // --- 安全性校验 ---
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // 验证 GitLab Secret Token
  const token = req.headers['x-gitlab-token'];
  if (token !== GITLAB_SECRET_TOKEN) {
    console.warn(`Unauthorized access attempt with token: ${token}`); // 在日志中记录错误的 token，便于排查
    return res.status(401).send('Unauthorized: Invalid Token');
  }

  try {
    const body = req.body;
    
    // --- 数据转换和扁平化 ---
    // 创建一个空对象，用于存放扁平化后的数据
    let flatPayload = {};

    // 提取通用字段
    flatPayload.object_kind = body.object_kind;
    flatPayload.user_name = body.user?.name;
    flatPayload.user_email = body.user?.email;
    flatPayload.project_name = body.project?.name;
    flatPayload.project_web_url = body.project?.web_url;

    // 根据事件类型 (object_kind) 提取特定字段
    const eventType = body.object_kind;

    if (eventType === 'push') {
      // Push 事件
      flatPayload.ref = body.ref;
      if (body.commits && body.commits.length > 0) {
        // 只提取第一个 commit 的信息
        const firstCommit = body.commits[0];
        flatPayload.commits0_id = firstCommit.id;
        flatPayload.commits0_message = firstCommit.message;
        flatPayload.commits0_url = firstCommit.url;
        flatPayload.commits0_author_name = firstCommit.author?.name;
        // 将数组转换为逗号分隔的字符串，并处理空数组的情况
        flatPayload.commits0_added = firstCommit.added?.join(', ') || '';
        flatPayload.commits0_modified = firstCommit.modified?.join(', ') || '';
        flatPayload.commits0_removed = firstCommit.removed?.join(', ') || '';
      }
    } else if (eventType === 'note') {
      // 评论事件 (Note)
      flatPayload.note_body = body.object_attributes?.note;
      flatPayload.note_url = body.object_attributes?.url;
      flatPayload.noteable_type = body.object_attributes?.noteable_type; // e.g., "MergeRequest", "Commit", "Issue"
    } else if (eventType === 'merge_request') {
      // 合并请求事件 (Merge Request)
      const mr = body.object_attributes;
      flatPayload.mr_title = mr?.title;
      flatPayload.mr_description = mr?.description;
      flatPayload.mr_state = mr?.state; // e.g., "opened", "merged", "closed"
      flatPayload.mr_action = mr?.action; // e.g., "open", "update", "merge"
      flatPayload.mr_url = mr?.url;
      flatPayload.mr_source_branch = mr?.source_branch;
      flatPayload.mr_target_branch = mr?.target_branch;
    }

    // --- 按照你的 API 要求封装数据 ---
    // 将所有扁平化后的数据放入 "Input" 对象中
    const finalApiPayload = {
      Input: flatPayload
    };

    // --- 发送数据到你的产品 API ---
    console.log('Sending to AirDroid Insight API:', JSON.stringify(finalApiPayload, null, 2));

    const apiResponse = await fetch(TARGET_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalApiPayload),
    });

    if (!apiResponse.ok) {
      // 如果 API 返回错误，记录下来
      const errorText = await apiResponse.text();
      console.error('Error from target API:', apiResponse.status, errorText);
      throw new Error(`Target API responded with status ${apiResponse.status}`);
    }

    // --- 向 GitLab 返回成功响应 ---
    console.log('Successfully forwarded event.');
    res.status(200).send('Event received and forwarded successfully.');

  } catch (error) {
    console.error('An error occurred:', error.message);
    // 向 GitLab 返回服务器错误
    res.status(500).send('Internal Server Error');
  }
}
