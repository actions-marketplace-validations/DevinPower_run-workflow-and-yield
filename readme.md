# Overview

This action will run a workflow in a remote repostiory and then poll to see if that workflow has finished running.

| Parameter | Description |
| -------- | ------- |
| owner | Owner of the target repository |
| repostiory | Name of the repository |
| branch | Branch or tag name to run the workflow for |
| access-token | GitHub personal access token with read/write for actions |
| timeout | How long before the action will try before giving up |
| poll-interval | How often to check the status of the workflow |
| enable-logging | Whether or not to display debug information in the logs |

### Example usage
```yaml
    - name: Sleep
      uses: DevinPower/run-workflow-and-yield@main
      with:
        owner: 'DevinPower'
        repostiory: 'run-workflow-and-yield'
        branch: 'main'
        access-token: 'my super secret key!'
        timeout: 30 #minutes
        poll-interval: 5 #seconds
        enable-logging: true

```