const core = require('@actions/core');

async function getRecentRuns(owner, repository, accessToken) {
    const URL = `https://api.github.com/repos/${owner}/${repository}/actions/runs`;

    const headers = new Headers();
    headers.append("Authorization", `Bearer ${accessToken}`);
    const requestOptions = {
        method: "GET",
        headers: headers,
        redirect: "follow"
    };

    return fetch(URL, requestOptions)
        .then((response) => response.json())
        .then((result) => {
            return result;
        });
}

async function normalizeWorkflowId(owner, repository, accessToken, workflowId){
    const URL = `https://api.github.com/repos/${owner}/${repository}/actions/workflows/${workflowId}`;

    const headers = new Headers();
    headers.append("Authorization", `Bearer ${accessToken}`);
    const requestOptions = {
        method: "GET",
        headers: headers,
        redirect: "follow"
    };

    return fetch(URL, requestOptions)
        .then((response) => response.json())
        .then((result) => {
            return result.id;
        });
}

async function getWorkflowRun(owner, repository, accessToken, workflowId) {
    const URL = `https://api.github.com/repos/${owner}/${repository}/actions/runs/${workflowId}`;

    const headers = new Headers();
    headers.append("Authorization", `Bearer ${accessToken}`);
    const requestOptions = {
        method: "GET",
        headers: headers,
        redirect: "follow"
    };

    return fetch(URL, requestOptions)
        .then((response) => response.json())
        .then((result) => {
            return result;
        });
}

async function tryUntilResult(func, args, pollInterval){
    async function attempt(){
        const result = await func(...args);
        
        if (result.success)
            return result.value;

        await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
        return await attempt();
    }
    return await attempt();
}

async function getWorkflowId(owner, repository, accessToken, normalizedId, validAfter) {
    const runs = await getRecentRuns(owner, repository, accessToken);
    for (const run of runs.workflow_runs){
        if (run.workflow_id != normalizedId)
            continue;

        if (new Date(run.run_started_at) > validAfter){
            return {
                success: true,
                value: run
            }
        }
    }

    return{
        success: false
    }
}

async function getWorkflowResult(owner, repository, accessToken, workflowId, failTime) {
    if (new Date() > failTime){
        return {
            success: true,
            value: 'run-workflow-and-yield action timeout.'
        }
    }

    const run = await getWorkflowRun(owner, repository, accessToken, workflowId)

    if (run.status == 'completed'){
        return {
            success: true,
            value: run.conclusion
        }
    }

    return{
        success: false
    }
}

async function triggerWorkflow(owner, repository, branch, workflow, accessToken, pollInterval){
    const validAfter = new Date();

    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", `Bearer ${accessToken}`);
    
    const raw = JSON.stringify({
      "ref": branch
    });
    
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow"
    };
    
   return fetch(`https://api.github.com/repos/${owner}/${repository}/actions/workflows/${workflow}/dispatches`, requestOptions)
    .then(() =>{
        return tryUntilResult(getWorkflowId, [owner, repository, accessToken, workflow, validAfter], pollInterval)
            .then((run) => {
                return run.id;
            })
    })
    .catch((error) => {console.log(error)});
}

async function yieldToComplete(owner, repository, accessToken, workflowId, pollInterval, enableLogging, timeout){
    const nowTime = new Date();
    const failTime = new Date(nowTime.getTime() + (timeout * 60 * 1000));

    if (enableLogging)
        console.log(`⚠️ awaiting workflow ${workflowId}`);

    return tryUntilResult(getWorkflowResult, [owner, repository, accessToken, workflowId, failTime], pollInterval)
        .then((workflowResult) =>{
            if (workflowResult != 'success'){
                console.log(`❌ workflow status '${workflowResult}' does not indicate success.`);
                throw new Error('Unexpected result as workflow completion status.');
            }
        })
}

function main(owner, repository, branch, workflow, accessToken, timeout, pollInterval, enableLogging){
    if (enableLogging)
        console.log(`👟 triggering ${workflow} in ${repository}`);
    
      triggerWorkflow(owner, repository, branch, workflow, accessToken, pollInterval)
        .then((workflowId) =>{
            if (enableLogging)
                console.log(`Obtained and yielding to ${workflowId}`);
            
            yieldToComplete(owner, repository, accessToken, workflowId, pollInterval, enableLogging, timeout).then(() =>{
                if (enableLogging){
                    console.log(`✔ workflow ${workflowId} successfully completed!`)
                }
            }).catch((error)=>{
                throw error;
            })
        })
}

try {
    const owner           = core.getInput('owner');
    const repository      = core.getInput('repository');
    const branch          = core.getInput('branch');
    const workflow        = core.getInput('workflow');
    const accessToken     = core.getInput('access-token');
    const timeout         = core.getInput('timeout');
    const pollInterval    = core.getInput('poll-interval') * 1000;
    const enableLogging   = core.getInput('enable-logging') == 'true';

    normalizeWorkflowId(owner, repository, accessToken, workflow).then((normalizedId) =>{
        main(owner, repository, branch, normalizedId, accessToken, timeout, pollInterval, enableLogging);
    })
} catch (error) {
    core.setFailed(error.message);
}