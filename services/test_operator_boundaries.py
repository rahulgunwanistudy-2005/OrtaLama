"""The public testnet preview must reject writes before any role can spend gas."""
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from services import operator_app

class OperatorBoundaries(unittest.TestCase):
    def test_public_testnet_rejects_every_mutation_before_handler(self):
        paths=['/rounds','/rounds/2/close','/rounds/2/sharing','/rounds/2/abort',
               '/rounds/2/cosign-live','/trustees/2/rounds/2/publish','/attacks/1']
        with patch.dict(os.environ,{'ORTALAMA_PUBLIC_TESTNET':'1'}), \
             patch.object(operator_app,'bridge') as bridge, \
             patch.object(operator_app,'publish') as publish, \
             patch.object(operator_app.threading,'Thread') as thread, \
             TestClient(operator_app.app) as client:
            for path in paths:
                with self.subTest(path=path):
                    response=client.post(path,json={})
                    self.assertEqual(response.status_code,403)
                    self.assertEqual(response.json(),{'detail':'PrivateTestnetCLIRequired'})
            bridge.assert_not_called();publish.assert_not_called();thread.assert_not_called()

    def test_public_testnet_reads_still_work(self):
        with patch.dict(os.environ,{'ORTALAMA_PUBLIC_TESTNET':'1'}), \
             patch.object(operator_app,'bridge',return_value={'simulation':True,'chainId':10143}), \
             TestClient(operator_app.app) as client:
            self.assertEqual(client.get('/health').status_code,200)
            self.assertEqual(client.get('/config').json()['chainId'],10143)

    def test_local_workflow_remains_available(self):
        with patch.dict(os.environ,{'ORTALAMA_PUBLIC_TESTNET':'0'}), \
             patch.object(operator_app,'bridge',return_value={'simulation':True}) as bridge, \
             TestClient(operator_app.app) as client:
            self.assertEqual(client.post('/rounds/2/sharing').status_code,200)
            bridge.assert_called_once_with('operatorLifecycle',roundId='2',operation='startSharing')

if __name__=='__main__':unittest.main()
