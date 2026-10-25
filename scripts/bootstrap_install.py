"""Retry interrupted dependency transfers without concealing install errors."""
import subprocess
import time

NETWORK_ERRORS=('ECONNRESET','ETIMEDOUT','EAI_AGAIN','ENETUNREACH','ENOTFOUND',
                'Connection reset by peer','RemoteDisconnected','ReadTimeoutError',
                'ConnectTimeoutError','Temporary failure in name resolution','network aborted')

def install(*command):
    for attempt in range(3):
        result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        print(result.stdout,end='',flush=True)
        if result.returncode==0:return
        if attempt==2 or not any(reason in result.stdout for reason in NETWORK_ERRORS):
            raise subprocess.CalledProcessError(result.returncode,command)
        print('Dependency transfer interrupted; retrying the pinned installation.',flush=True)
        time.sleep(2**attempt)
