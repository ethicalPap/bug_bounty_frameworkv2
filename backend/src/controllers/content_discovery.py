import asyncio
import subprocess
import json
import uuid
import logging
import re
import os
import tempfile
from typing import List, Dict, Optional, Set
from urllib.parse import urlparse, urljoin
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
import requests
from requests.packages.urllib3.exceptions import InsecureRequestWarning
from sqlalchemy.orm import Session
from sqlalchemy import and_

from src.config.database import get_db, SessionLocal
from src.models.ContentDiscovery import ContentDiscovery, JSEndpoint, APIParameter
from src.models.Workspace import Workspace

# Disable SSL warnings
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _touch_workspace(db: Session, workspace_id: str):
    """Update workspace updated_at timestamp"""
    if workspace_id:
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if workspace:
            workspace.updated_at = datetime.utcnow()
            db.commit()


@dataclass
class ContentDiscoveryConfig:
    target_url: str
    workspace_id: Optional[str] = None  # Workspace isolation
    scan_type: str = "full"  # full, fuzzing, passive, crawling, js_analysis, api
    
    # Fuzzing options
    use_ffuf: bool = True
    use_feroxbuster: bool = True
    wordlist: str = "/opt/wordlists/common.txt"
    
    # Passive options
    use_waymore: bool = True
    use_gau: bool = True
    
    # Crawling options
    use_katana: bool = True
    use_gospider: bool = True
    use_hakrawler: bool = False
    use_zap_spider: bool = False
    use_zap_ajax: bool = False
    crawl_depth: int = 3
    
    # JS Analysis options
    use_linkfinder: bool = True
    use_jsluice: bool = False
    
    # API Discovery options
    use_kiterunner: bool = False
    use_paramspider: bool = False
    
    # Specialized tools
    use_unfurl: bool = True
    use_uro: bool = True
    use_nuclei: bool = False
    
    # General options
    threads: int = 10
    timeout: int = 600
    rate_limit: int = 150
    follow_redirects: bool = True
    subdomain_id: Optional[int] = None
    
    # ZAP Configuration
    zap_api_key: str = os.getenv('ZAP_API_KEY', '')
    zap_proxy: str = os.getenv('ZAP_PROXY', 'http://localhost:8080')


class ContentDiscoveryScanner:
    def __init__(self, config: ContentDiscoveryConfig):
        self.config = config
        self.scan_id = str(uuid.uuid4())
        self.discovered_urls: Set[str] = set()
        self.results: List[Dict] = []
        
    def check_tool_installed(self, tool_name: str) -> bool:
        try:
            result = subprocess.run(['which', tool_name], capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except Exception as e:
            logger.warning(f"Error checking tool {tool_name}: {e}")
            return False
    
    def normalize_url(self, url: str) -> str:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        return url.rstrip('/')
    
    def extract_path(self, url: str) -> str:
        parsed = urlparse(url)
        path = parsed.path or '/'
        if parsed.query:
            path += '?' + parsed.query
        return path
    
    # ==================== FUZZING TOOLS ====================
    
    def run_ffuf(self) -> Set[Dict]:
        if not self.check_tool_installed('ffuf'):
            logger.warning("ffuf not installed, skipping...")
            return set()
        
        logger.info(f"Running ffuf for {self.config.target_url}")
        results = set()
        
        try:
            target = self.normalize_url(self.config.target_url)
            output_file = f"/tmp/ffuf_{self.scan_id}.json"
            
            cmd = [
                'ffuf', '-u', f"{target}/FUZZ", '-w', self.config.wordlist,
                '-mc', 'all', '-fc', '404', '-t', str(self.config.threads),
                '-rate', str(self.config.rate_limit), '-o', output_file,
                '-of', 'json', '-s', '-timeout', '10'
            ]
            
            subprocess.run(cmd, capture_output=True, timeout=self.config.timeout)
            
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    data = json.load(f)
                    for result in data.get('results', []):
                        discovered_url = result.get('url', '')
                        if discovered_url:
                            results.add(json.dumps({
                                'url': discovered_url,
                                'status_code': result.get('status', 0),
                                'content_length': result.get('length', 0),
                                'words': result.get('words', 0),
                                'lines': result.get('lines', 0),
                                'response_time': result.get('duration', 0) // 1000000,
                                'tool': 'ffuf',
                                'discovery_type': 'fuzzing'
                            }))
                os.unlink(output_file)
            
            logger.info(f"ffuf found {len(results)} paths")
            
        except subprocess.TimeoutExpired:
            logger.error(f"ffuf timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"ffuf error: {e}")
        
        return results
    
    def run_feroxbuster(self) -> Set[Dict]:
        if not self.check_tool_installed('feroxbuster'):
            logger.warning("feroxbuster not installed, skipping...")
            return set()
        
        logger.info(f"Running feroxbuster for {self.config.target_url}")
        results = set()
        
        try:
            target = self.normalize_url(self.config.target_url)
            output_file = f"/tmp/feroxbuster_{self.scan_id}.json"
            
            cmd = [
                'feroxbuster', '-u', target, '-w', self.config.wordlist,
                '-t', str(self.config.threads), '--rate-limit', str(self.config.rate_limit),
                '-o', output_file, '--json', '--silent', '--auto-bail', '--auto-tune',
                '-d', '2', '-k', '--timeout', '10'
            ]
            
            subprocess.run(cmd, capture_output=True, timeout=self.config.timeout)
            
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    for line in f:
                        try:
                            data = json.loads(line.strip())
                            if data.get('type') == 'response':
                                results.add(json.dumps({
                                    'url': data.get('url', ''),
                                    'status_code': data.get('status', 0),
                                    'content_length': data.get('content_length', 0),
                                    'words': data.get('word_count', 0),
                                    'lines': data.get('line_count', 0),
                                    'tool': 'feroxbuster',
                                    'discovery_type': 'fuzzing'
                                }))
                        except json.JSONDecodeError:
                            continue
                os.unlink(output_file)
            
            logger.info(f"feroxbuster found {len(results)} paths")
            
        except subprocess.TimeoutExpired:
            logger.error(f"feroxbuster timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"feroxbuster error: {e}")
        
        return results
    
    # ==================== PASSIVE DISCOVERY ====================
    
    def run_waymore(self) -> Set[Dict]:
        if not self.check_tool_installed('waymore'):
            logger.warning("waymore not installed, skipping...")
            return set()
        
        logger.info(f"Running waymore for {self.config.target_url}")
        results = set()
        
        try:
            parsed = urlparse(self.normalize_url(self.config.target_url))
            domain = parsed.netloc
            output_dir = f"/tmp/waymore_{self.scan_id}"
            os.makedirs(output_dir, exist_ok=True)
            
            cmd = ['waymore', '-i', domain, '-mode', 'U', '-oU', f"{output_dir}/urls.txt", '-xcc']
            subprocess.run(cmd, capture_output=True, timeout=self.config.timeout)
            
            urls_file = f"{output_dir}/urls.txt"
            if os.path.exists(urls_file):
                with open(urls_file, 'r') as f:
                    for line in f:
                        url = line.strip()
                        if url and parsed.netloc in url:
                            results.add(json.dumps({'url': url, 'tool': 'waymore', 'discovery_type': 'passive'}))
            
            import shutil
            shutil.rmtree(output_dir, ignore_errors=True)
            logger.info(f"waymore found {len(results)} URLs")
            
        except subprocess.TimeoutExpired:
            logger.error(f"waymore timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"waymore error: {e}")
        
        return results
    
    def run_gau(self) -> Set[Dict]:
        if not self.check_tool_installed('gau'):
            logger.warning("gau not installed, skipping...")
            return set()
        
        logger.info(f"Running gau for {self.config.target_url}")
        results = set()
        
        try:
            parsed = urlparse(self.normalize_url(self.config.target_url))
            domain = parsed.netloc
            
            cmd = ['gau', '--threads', str(self.config.threads), '--blacklist', 'ttf,woff,svg,png,jpg,jpeg,gif,css', domain]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=self.config.timeout)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    url = line.strip()
                    if url and parsed.netloc in url:
                        results.add(json.dumps({'url': url, 'tool': 'gau', 'discovery_type': 'passive'}))
            
            logger.info(f"gau found {len(results)} URLs")
            
        except subprocess.TimeoutExpired:
            logger.error(f"gau timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"gau error: {e}")
        
        return results
    
    # ==================== CRAWLING ====================
    
    def run_katana(self) -> Set[Dict]:
        if not self.check_tool_installed('katana'):
            logger.warning("katana not installed, skipping...")
            return set()
        
        logger.info(f"Running katana for {self.config.target_url}")
        results = set()
        
        try:
            target = self.normalize_url(self.config.target_url)
            output_file = f"/tmp/katana_{self.scan_id}.json"
            
            cmd = ['katana', '-u', target, '-d', str(self.config.crawl_depth), '-c', str(self.config.threads),
                   '-jc', '-jsonl', '-o', output_file, '-silent', '-timeout', '10']
            subprocess.run(cmd, capture_output=True, timeout=self.config.timeout)
            
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    for line in f:
                        try:
                            data = json.loads(line.strip())
                            url = data.get('url', data.get('endpoint', ''))
                            if url:
                                results.add(json.dumps({
                                    'url': url, 'status_code': data.get('status_code', 0),
                                    'tool': 'katana', 'discovery_type': 'crawling'
                                }))
                        except json.JSONDecodeError:
                            continue
                os.unlink(output_file)
            
            logger.info(f"katana found {len(results)} URLs")
            
        except subprocess.TimeoutExpired:
            logger.error(f"katana timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"katana error: {e}")
        
        return results
    
    def run_gospider(self) -> Set[Dict]:
        if not self.check_tool_installed('gospider'):
            logger.warning("gospider not installed, skipping...")
            return set()
        
        logger.info(f"Running gospider for {self.config.target_url}")
        results = set()
        
        try:
            target = self.normalize_url(self.config.target_url)
            cmd = ['gospider', '-s', target, '-d', str(self.config.crawl_depth), '-c', str(self.config.threads),
                   '-t', '10', '--json', '--no-redirect']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=self.config.timeout)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    try:
                        data = json.loads(line)
                        url = data.get('output', '')
                        if url and url.startswith('http'):
                            results.add(json.dumps({'url': url, 'tool': 'gospider', 'discovery_type': 'crawling'}))
                    except json.JSONDecodeError:
                        continue
            
            logger.info(f"gospider found {len(results)} URLs")
            
        except subprocess.TimeoutExpired:
            logger.error(f"gospider timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"gospider error: {e}")
        
        return results
    
    def run_hakrawler(self) -> Set[Dict]:
        if not self.check_tool_installed('hakrawler'):
            logger.warning("hakrawler not installed, skipping...")
            return set()
        
        logger.info(f"Running hakrawler for {self.config.target_url}")
        results = set()
        
        try:
            target = self.normalize_url(self.config.target_url)
            cmd = ['hakrawler', '-url', target, '-depth', str(self.config.crawl_depth), '-plain']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=self.config.timeout)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    url = line.strip()
                    if url and url.startswith('http'):
                        results.add(json.dumps({'url': url, 'tool': 'hakrawler', 'discovery_type': 'crawling'}))
            
            logger.info(f"hakrawler found {len(results)} URLs")
            
        except subprocess.TimeoutExpired:
            logger.error(f"hakrawler timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"hakrawler error: {e}")
        
        return results
    
    def run_zap_spider(self) -> Set[Dict]:
        logger.info(f"Running ZAP Spider for {self.config.target_url}")
        results = set()
        
        try:
            target = self.normalize_url(self.config.target_url)
            zap_base = self.config.zap_proxy
            api_key = self.config.zap_api_key
            
            start_url = f"{zap_base}/JSON/spider/action/scan/"
            params = {'apikey': api_key, 'url': target, 'maxChildren': '100', 'recurse': 'true', 'subtreeOnly': 'true'}
            
            response = requests.get(start_url, params=params, timeout=30)
            if response.status_code != 200:
                logger.error(f"ZAP Spider failed to start: {response.text}")
                return results
            
            scan_id = response.json().get('scan')
            logger.info(f"ZAP Spider started with scan ID: {scan_id}")
            
            status_url = f"{zap_base}/JSON/spider/view/status/"
            max_wait = self.config.timeout
            waited = 0
            
            while waited < max_wait:
                status_response = requests.get(status_url, params={'apikey': api_key, 'scanId': scan_id}, timeout=10)
                status = int(status_response.json().get('status', '0'))
                if status >= 100:
                    break
                import time
                time.sleep(5)
                waited += 5
            
            results_url = f"{zap_base}/JSON/spider/view/results/"
            results_response = requests.get(results_url, params={'apikey': api_key, 'scanId': scan_id}, timeout=30)
            
            if results_response.status_code == 200:
                urls = results_response.json().get('results', [])
                for url in urls:
                    if url:
                        results.add(json.dumps({'url': url, 'tool': 'zap_spider', 'discovery_type': 'crawling'}))
            
            logger.info(f"ZAP Spider found {len(results)} URLs")
            
        except requests.exceptions.ConnectionError:
            logger.error("ZAP is not running or not accessible")
        except Exception as e:
            logger.error(f"ZAP Spider error: {e}")
        
        return results
    
    def run_zap_ajax_spider(self) -> Set[Dict]:
        logger.info(f"Running ZAP Ajax Spider for {self.config.target_url}")
        results = set()
        
        try:
            target = self.normalize_url(self.config.target_url)
            zap_base = self.config.zap_proxy
            api_key = self.config.zap_api_key
            
            start_url = f"{zap_base}/JSON/ajaxSpider/action/scan/"
            params = {'apikey': api_key, 'url': target, 'inScope': 'true', 'subtreeOnly': 'true'}
            
            response = requests.get(start_url, params=params, timeout=30)
            if response.status_code != 200:
                logger.error(f"ZAP Ajax Spider failed to start: {response.text}")
                return results
            
            status_url = f"{zap_base}/JSON/ajaxSpider/view/status/"
            max_wait = self.config.timeout
            waited = 0
            
            while waited < max_wait:
                status_response = requests.get(status_url, params={'apikey': api_key}, timeout=10)
                status = status_response.json().get('status', '')
                if status == 'stopped':
                    break
                import time
                time.sleep(5)
                waited += 5
            
            results_url = f"{zap_base}/JSON/ajaxSpider/view/results/"
            results_response = requests.get(results_url, params={'apikey': api_key, 'start': '0', 'count': '10000'}, timeout=30)
            
            if results_response.status_code == 200:
                items = results_response.json().get('results', [])
                for item in items:
                    url = item.get('requestHeader', '').split(' ')[1] if 'requestHeader' in item else ''
                    if url and url.startswith('/'):
                        parsed = urlparse(target)
                        url = f"{parsed.scheme}://{parsed.netloc}{url}"
                    if url and url.startswith('http'):
                        results.add(json.dumps({'url': url, 'tool': 'zap_ajax_spider', 'discovery_type': 'crawling'}))
            
            sites_url = f"{zap_base}/JSON/core/view/urls/"
            sites_response = requests.get(sites_url, params={'apikey': api_key, 'baseurl': target}, timeout=30)
            
            if sites_response.status_code == 200:
                urls = sites_response.json().get('urls', [])
                for url in urls:
                    if url:
                        results.add(json.dumps({'url': url, 'tool': 'zap_ajax_spider', 'discovery_type': 'crawling'}))
            
            logger.info(f"ZAP Ajax Spider found {len(results)} URLs")
            
        except requests.exceptions.ConnectionError:
            logger.error("ZAP is not running or not accessible")
        except Exception as e:
            logger.error(f"ZAP Ajax Spider error: {e}")
        
        return results
    
    # ==================== JS ANALYSIS ====================
    
    def run_linkfinder(self) -> Set[Dict]:
        if not self.check_tool_installed('python3'):
            logger.warning("Python3 not installed, skipping LinkFinder...")
            return set()
        
        logger.info(f"Running LinkFinder for {self.config.target_url}")
        results = set()
        js_endpoints = []
        
        try:
            target = self.normalize_url(self.config.target_url)
            cmd = ['python3', '/opt/LinkFinder/linkfinder.py', '-i', target, '-o', 'cli']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=self.config.timeout)
            
            if result.returncode == 0:
                endpoint_pattern = re.compile(r'(\/[a-zA-Z0-9_\/\-\.\{\}]*)')
                for match in endpoint_pattern.finditer(result.stdout):
                    endpoint = match.group(1)
                    if endpoint and len(endpoint) > 1:
                        full_url = urljoin(target, endpoint)
                        results.add(json.dumps({'url': full_url, 'tool': 'linkfinder', 'discovery_type': 'js_analysis'}))
                        js_endpoints.append({'endpoint': endpoint, 'source_url': target, 'tool': 'linkfinder'})
            
            logger.info(f"LinkFinder found {len(results)} endpoints")
            self.save_js_endpoints(js_endpoints)
            
        except subprocess.TimeoutExpired:
            logger.error(f"LinkFinder timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"LinkFinder error: {e}")
        
        return results
    
    def run_jsluice(self) -> Set[Dict]:
        if not self.check_tool_installed('jsluice'):
            logger.warning("jsluice not installed, skipping...")
            return set()
        
        logger.info(f"Running jsluice for {self.config.target_url}")
        results = set()
        
        try:
            target = self.normalize_url(self.config.target_url)
            response = requests.get(target, timeout=30, verify=False)
            
            if response.status_code == 200:
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.js') as tmp:
                    tmp.write(response.text)
                    tmp_file = tmp.name
                
                cmd = ['jsluice', 'urls', tmp_file]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                
                if result.returncode == 0:
                    for line in result.stdout.strip().split('\n'):
                        try:
                            data = json.loads(line)
                            url = data.get('url', '')
                            if url:
                                if url.startswith('/'):
                                    parsed = urlparse(target)
                                    url = f"{parsed.scheme}://{parsed.netloc}{url}"
                                results.add(json.dumps({'url': url, 'tool': 'jsluice', 'discovery_type': 'js_analysis'}))
                        except json.JSONDecodeError:
                            continue
                
                os.unlink(tmp_file)
            
            logger.info(f"jsluice found {len(results)} URLs")
            
        except Exception as e:
            logger.error(f"jsluice error: {e}")
        
        return results
    
    # ==================== PARAMETER DISCOVERY ====================
    
    def run_paramspider(self) -> Set[Dict]:
        if not self.check_tool_installed('paramspider'):
            logger.warning("paramspider not installed, skipping...")
            return set()
        
        logger.info(f"Running ParamSpider for {self.config.target_url}")
        results = set()
        parameters = []
        
        try:
            parsed = urlparse(self.normalize_url(self.config.target_url))
            domain = parsed.netloc
            output_dir = f"/tmp/paramspider_{self.scan_id}"
            os.makedirs(output_dir, exist_ok=True)
            
            cmd = ['paramspider', '-d', domain, '-o', f"{output_dir}/params.txt"]
            subprocess.run(cmd, capture_output=True, timeout=self.config.timeout)
            
            output_file = f"{output_dir}/params.txt"
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    for line in f:
                        url = line.strip()
                        if url:
                            results.add(json.dumps({'url': url, 'tool': 'paramspider', 'discovery_type': 'api'}))
                            parsed_url = urlparse(url)
                            if parsed_url.query:
                                for param in parsed_url.query.split('&'):
                                    param_name = param.split('=')[0]
                                    if param_name:
                                        parameters.append({
                                            'target_url': url.split('?')[0],
                                            'parameter_name': param_name,
                                            'parameter_type': 'query',
                                            'tool': 'paramspider'
                                        })
            
            import shutil
            shutil.rmtree(output_dir, ignore_errors=True)
            logger.info(f"ParamSpider found {len(results)} URLs with parameters")
            
            if parameters:
                self.save_api_parameters(parameters)
            
        except subprocess.TimeoutExpired:
            logger.error(f"ParamSpider timeout for {self.config.target_url}")
        except Exception as e:
            logger.error(f"ParamSpider error: {e}")
        
        return results
    
    # ==================== SPECIALIZED TOOLS ====================
    
    def run_unfurl(self, urls: Set[str]) -> Set[Dict]:
        if not self.check_tool_installed('unfurl'):
            logger.warning("unfurl not installed, skipping...")
            return urls
        
        logger.info(f"Running unfurl for URL processing")
        results = set()
        
        try:
            input_urls = '\n'.join([json.loads(u).get('url', '') for u in urls if 'url' in json.loads(u)])
            cmd = ['unfurl', '--unique', 'format', '%s://%d%p']
            result = subprocess.run(cmd, input=input_urls, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    url = line.strip()
                    if url:
                        results.add(json.dumps({'url': url, 'tool': 'unfurl', 'discovery_type': 'specialized'}))
            
            logger.info(f"unfurl processed {len(results)} URLs")
            
        except Exception as e:
            logger.error(f"unfurl error: {e}")
            return urls
        
        return results if results else urls
    
    def run_uro(self, urls: Set[str]) -> Set[Dict]:
        if not self.check_tool_installed('uro'):
            logger.warning("uro not installed, skipping...")
            return urls
        
        logger.info(f"Running uro for URL filtering")
        results = set()
        
        try:
            input_urls = '\n'.join([json.loads(u).get('url', '') for u in urls if 'url' in json.loads(u)])
            cmd = ['uro']
            result = subprocess.run(cmd, input=input_urls, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    url = line.strip()
                    if url:
                        for orig_url in urls:
                            orig_data = json.loads(orig_url)
                            if orig_data.get('url') == url:
                                results.add(orig_url)
                                break
            
            logger.info(f"uro filtered to {len(results)} unique URLs")
            
        except Exception as e:
            logger.error(f"uro error: {e}")
            return urls
        
        return results if results else urls
    
    def run_nuclei(self, urls: Set[str]) -> Set[Dict]:
        if not self.check_tool_installed('nuclei'):
            logger.warning("nuclei not installed, skipping...")
            return set()
        
        logger.info(f"Running nuclei for vulnerability detection")
        results = set()
        
        try:
            unique_urls = set([json.loads(u).get('url', '') for u in urls if 'url' in json.loads(u)])
            if not unique_urls:
                return set()
            
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as tmp:
                tmp.write('\n'.join(unique_urls))
                tmp_file = tmp.name
            
            output_file = f"/tmp/nuclei_{self.scan_id}.json"
            
            cmd = ['nuclei', '-l', tmp_file, '-t', '/root/nuclei-templates/http/',
                   '-c', str(self.config.threads), '-rl', str(self.config.rate_limit),
                   '-jsonl', '-o', output_file, '-silent', '-severity', 'medium,high,critical']
            
            subprocess.run(cmd, capture_output=True, timeout=self.config.timeout)
            
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    for line in f:
                        try:
                            data = json.loads(line.strip())
                            results.add(json.dumps({
                                'url': data.get('matched-at', data.get('host', '')),
                                'tool': 'nuclei', 'discovery_type': 'specialized',
                                'vulnerability': data.get('info', {}).get('name', ''),
                                'severity': data.get('info', {}).get('severity', '')
                            }))
                        except json.JSONDecodeError:
                            continue
                os.unlink(output_file)
            
            os.unlink(tmp_file)
            logger.info(f"nuclei found {len(results)} potential vulnerabilities")
            
        except subprocess.TimeoutExpired:
            logger.error(f"nuclei timeout")
        except Exception as e:
            logger.error(f"nuclei error: {e}")
        
        return results
    
    # ==================== DATABASE OPERATIONS ====================
    
    def save_to_database(self, results: Set[str]) -> int:
        db = SessionLocal()
        saved_count = 0
        
        try:
            for result_json in results:
                try:
                    result = json.loads(result_json)
                    url = result.get('url', '')
                    if not url:
                        continue
                    
                    query = db.query(ContentDiscovery).filter(
                        ContentDiscovery.discovered_url == url,
                        ContentDiscovery.target_url == self.config.target_url
                    )
                    if self.config.workspace_id:
                        query = query.filter(ContentDiscovery.workspace_id == self.config.workspace_id)
                    
                    existing = query.first()
                    
                    if not existing:
                        new_discovery = ContentDiscovery(
                            workspace_id=self.config.workspace_id,
                            subdomain_id=self.config.subdomain_id,
                            target_url=self.config.target_url,
                            discovered_url=url,
                            path=self.extract_path(url),
                            status_code=result.get('status_code'),
                            content_length=result.get('content_length'),
                            method=result.get('method', 'GET'),
                            discovery_type=result.get('discovery_type', 'unknown'),
                            tool_name=result.get('tool', 'unknown'),
                            response_time=result.get('response_time'),
                            words_count=result.get('words'),
                            lines_count=result.get('lines'),
                            scan_id=self.scan_id,
                            is_interesting=self._is_interesting(result)
                        )
                        db.add(new_discovery)
                        saved_count += 1
                        
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    logger.error(f"Error saving result: {e}")
                    continue
            
            db.commit()
            _touch_workspace(db, self.config.workspace_id)
            logger.info(f"Saved {saved_count} new discoveries to database")
            
        except Exception as e:
            logger.error(f"Database error: {e}")
            db.rollback()
        finally:
            db.close()
        
        return saved_count
    
    def save_js_endpoints(self, endpoints: List[Dict]) -> int:
        db = SessionLocal()
        saved_count = 0
        
        try:
            for endpoint in endpoints:
                try:
                    new_endpoint = JSEndpoint(
                        workspace_id=self.config.workspace_id,
                        source_url=endpoint.get('source_url', ''),
                        endpoint=endpoint.get('endpoint', ''),
                        endpoint_type='path',
                        confidence='medium',
                        scan_id=self.scan_id
                    )
                    db.add(new_endpoint)
                    saved_count += 1
                except Exception as e:
                    logger.error(f"Error saving JS endpoint: {e}")
                    continue
            
            db.commit()
            logger.info(f"Saved {saved_count} JS endpoints to database")
            
        except Exception as e:
            logger.error(f"Database error: {e}")
            db.rollback()
        finally:
            db.close()
        
        return saved_count
    
    def save_api_parameters(self, parameters: List[Dict]) -> int:
        db = SessionLocal()
        saved_count = 0
        
        try:
            for param in parameters:
                try:
                    new_param = APIParameter(
                        workspace_id=self.config.workspace_id,
                        target_url=param.get('target_url', ''),
                        parameter_name=param.get('parameter_name', ''),
                        parameter_type=param.get('parameter_type', 'query'),
                        scan_id=self.scan_id
                    )
                    db.add(new_param)
                    saved_count += 1
                except Exception as e:
                    logger.error(f"Error saving parameter: {e}")
                    continue
            
            db.commit()
            logger.info(f"Saved {saved_count} API parameters to database")
            
        except Exception as e:
            logger.error(f"Database error: {e}")
            db.rollback()
        finally:
            db.close()
        
        return saved_count
    
    def _is_interesting(self, result: Dict) -> bool:
        status_code = result.get('status_code', 0)
        content_length = result.get('content_length', 0)
        interesting_codes = [200, 201, 301, 302, 307, 401, 403, 500, 503]
        interesting_keywords = ['admin', 'api', 'backup', 'config', 'debug', 'dev', 'test', 'staging', 'internal', 'private']
        url = result.get('url', '').lower()
        
        if status_code in interesting_codes:
            return True
        if any(keyword in url for keyword in interesting_keywords):
            return True
        if content_length > 1000000:
            return True
        return False
    
    # ==================== MAIN SCAN ====================
    
    def run_scan(self) -> Dict:
        logger.info(f"Starting content discovery for {self.config.target_url} (scan_id: {self.scan_id})")
        
        all_results = set()
        tool_results = {}
        scan_type = self.config.scan_type.lower()
        
        if scan_type in ['full', 'fuzzing']:
            if self.config.use_ffuf:
                r = self.run_ffuf()
                all_results.update(r)
                tool_results['ffuf'] = len(r)
            if self.config.use_feroxbuster:
                r = self.run_feroxbuster()
                all_results.update(r)
                tool_results['feroxbuster'] = len(r)
        
        if scan_type in ['full', 'passive']:
            if self.config.use_waymore:
                r = self.run_waymore()
                all_results.update(r)
                tool_results['waymore'] = len(r)
            if self.config.use_gau:
                r = self.run_gau()
                all_results.update(r)
                tool_results['gau'] = len(r)
        
        if scan_type in ['full', 'crawling', 'api']:
            if self.config.use_katana:
                r = self.run_katana()
                all_results.update(r)
                tool_results['katana'] = len(r)
            if self.config.use_gospider:
                r = self.run_gospider()
                all_results.update(r)
                tool_results['gospider'] = len(r)
            if self.config.use_hakrawler:
                r = self.run_hakrawler()
                all_results.update(r)
                tool_results['hakrawler'] = len(r)
            if self.config.use_zap_spider:
                r = self.run_zap_spider()
                all_results.update(r)
                tool_results['zap_spider'] = len(r)
            if self.config.use_zap_ajax:
                r = self.run_zap_ajax_spider()
                all_results.update(r)
                tool_results['zap_ajax_spider'] = len(r)
        
        if scan_type in ['full', 'js_analysis', 'javascript']:
            if self.config.use_linkfinder:
                r = self.run_linkfinder()
                all_results.update(r)
                tool_results['linkfinder'] = len(r)
            if self.config.use_jsluice:
                r = self.run_jsluice()
                all_results.update(r)
                tool_results['jsluice'] = len(r)
        
        if scan_type in ['full', 'api']:
            if self.config.use_paramspider:
                r = self.run_paramspider()
                all_results.update(r)
                tool_results['paramspider'] = len(r)
        
        if all_results:
            if self.config.use_unfurl:
                all_results = self.run_unfurl(all_results)
            if self.config.use_uro:
                all_results = self.run_uro(all_results)
            if self.config.use_nuclei and scan_type == 'full':
                r = self.run_nuclei(all_results)
                all_results.update(r)
                tool_results['nuclei'] = len(r)
        
        saved_count = self.save_to_database(all_results)
        
        db = SessionLocal()
        try:
            saved_records = db.query(ContentDiscovery).filter(ContentDiscovery.scan_id == self.scan_id).all()
            
            scan_summary = {
                'scan_id': self.scan_id,
                'workspace_id': self.config.workspace_id,
                'target_url': self.config.target_url,
                'scan_type': self.config.scan_type,
                'total_unique_urls': len(all_results),
                'new_urls_saved': saved_count,
                'tool_results': tool_results,
                'timestamp': datetime.utcnow().isoformat(),
                'discovered_urls': [
                    {
                        'id': record.id,
                        'discovered_url': record.discovered_url,
                        'status_code': record.status_code,
                        'method': record.method or 'GET',
                        'tool_name': record.tool_name,
                        'is_interesting': record.is_interesting,
                        'content_length': record.content_length,
                        'response_time': record.response_time,
                        'discovery_type': record.discovery_type,
                        'created_at': record.created_at.isoformat() if record.created_at else None
                    }
                    for record in saved_records
                ]
            }
        finally:
            db.close()
        
        logger.info(f"Content discovery completed: {scan_summary}")
        return scan_summary


# ==================== API FUNCTIONS ====================

def start_content_discovery(target_url: str, workspace_id: Optional[str] = None, **kwargs) -> Dict:
    config = ContentDiscoveryConfig(target_url=target_url, workspace_id=workspace_id, **kwargs)
    scanner = ContentDiscoveryScanner(config)
    return scanner.run_scan()


def get_content_by_target(target_url: str, db: Session, workspace_id: Optional[str] = None) -> List[Dict]:
    query = db.query(ContentDiscovery).filter(ContentDiscovery.target_url == target_url)
    if workspace_id:
        query = query.filter(ContentDiscovery.workspace_id == workspace_id)
    results = query.order_by(ContentDiscovery.created_at.desc()).all()
    return [result.to_dict() for result in results]


def get_content_by_scan(scan_id: str, db: Session) -> List[Dict]:
    results = db.query(ContentDiscovery).filter(ContentDiscovery.scan_id == scan_id).order_by(ContentDiscovery.discovered_url).all()
    return [result.to_dict() for result in results]


def get_content_by_workspace(workspace_id: str, db: Session) -> List[Dict]:
    results = db.query(ContentDiscovery).filter(ContentDiscovery.workspace_id == workspace_id).order_by(ContentDiscovery.created_at.desc()).all()
    return [result.to_dict() for result in results]


def get_interesting_discoveries(db: Session, workspace_id: Optional[str] = None, limit: int = 100) -> List[Dict]:
    query = db.query(ContentDiscovery).filter(ContentDiscovery.is_interesting == True)
    if workspace_id:
        query = query.filter(ContentDiscovery.workspace_id == workspace_id)
    results = query.order_by(ContentDiscovery.created_at.desc()).limit(limit).all()
    return [result.to_dict() for result in results]


def get_js_endpoints(source_url: str, db: Session, workspace_id: Optional[str] = None) -> List[Dict]:
    query = db.query(JSEndpoint).filter(JSEndpoint.source_url == source_url)
    if workspace_id:
        query = query.filter(JSEndpoint.workspace_id == workspace_id)
    endpoints = query.all()
    return [endpoint.to_dict() for endpoint in endpoints]


def get_api_parameters(target_url: str, db: Session, workspace_id: Optional[str] = None) -> List[Dict]:
    query = db.query(APIParameter).filter(APIParameter.target_url == target_url)
    if workspace_id:
        query = query.filter(APIParameter.workspace_id == workspace_id)
    parameters = query.all()
    return [param.to_dict() for param in parameters]