import subprocess
import unittest
from unittest.mock import patch
from scripts.bootstrap_install import install

class BootstrapInstall(unittest.TestCase):
    @patch('scripts.bootstrap_install.time.sleep')
    @patch('scripts.bootstrap_install.subprocess.run')
    def test_interrupted_transfer_retries_the_same_pinned_command(self,run,sleep):
        run.side_effect=[subprocess.CompletedProcess([],1,'npm error ECONNRESET'),subprocess.CompletedProcess([],0,'installed')]
        install('npm','ci','--ignore-scripts')
        self.assertEqual(run.call_count,2)
        self.assertEqual(run.call_args_list[0],run.call_args_list[1]);sleep.assert_called_once()

    @patch('scripts.bootstrap_install.time.sleep')
    @patch('scripts.bootstrap_install.subprocess.run')
    def test_non_network_install_error_fails_immediately(self,run,sleep):
        run.return_value=subprocess.CompletedProcess([],1,'Invalid lockfile')
        with self.assertRaises(subprocess.CalledProcessError):install('npm','ci','--ignore-scripts')
        run.assert_called_once();sleep.assert_not_called()

    @patch('scripts.bootstrap_install.time.sleep')
    @patch('scripts.bootstrap_install.subprocess.run')
    def test_network_retries_are_bounded(self,run,sleep):
        run.return_value=subprocess.CompletedProcess([],1,'ECONNRESET')
        with self.assertRaises(subprocess.CalledProcessError):install('npm','ci','--ignore-scripts')
        self.assertEqual(run.call_count,3);self.assertEqual(sleep.call_count,2)

if __name__=='__main__':unittest.main()
