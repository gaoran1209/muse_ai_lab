import json
import os
import time
import uuid
from urllib.parse import urlparse

import oss2
import requests

# OSS 配置从环境变量读取
def _build_default_oss_config() -> str:
    """从环境变量构建 OSS 配置 JSON 字符串"""
    endpoint = os.environ.get('OSS_ENDPOINT', '')
    if not endpoint:
        return '{}'
    config = {
        'endpoint': endpoint,
        'bucket_name': os.environ.get('OSS_BUCKET_NAME', ''),
        'access_key_id': os.environ.get('OSS_ACCESS_KEY_ID', ''),
        'secret_access_key': os.environ.get('OSS_SECRET_ACCESS_KEY', ''),
        'display_host': os.environ.get('OSS_DISPLAY_HOST', ''),
        'remote_dir': os.environ.get('OSS_REMOTE_DIR', 'upload'),
    }
    return json.dumps(config)

DEFAULT_OSS_CONFIG = _build_default_oss_config()


def has_usable_oss_config(config: str | None) -> bool:
    if not config:
        return False
    try:
        payload = json.loads(config)
    except json.JSONDecodeError:
        return False
    required = ("endpoint", "bucket_name", "access_key_id", "secret_access_key")
    return all(str(payload.get(key, "")).strip() for key in required)


class BucketCommand:

    def __init__(self, *, endpoint, bucket_name, access_key_id, secret_access_key, display_host, remote_dir):
        self.endpoint = endpoint
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.bucket_name = bucket_name

        self.display_host = display_host
        self.remote_dir = remote_dir

        self.bucket = self.get_bucket()

    def get_bucket(self):
        auth = oss2.Auth(self.access_key_id, self.secret_access_key)
        bucket = oss2.Bucket(auth, self.endpoint, self.bucket_name)
        return bucket

    @classmethod
    def from_str_config(cls, config):
        if not has_usable_oss_config(config):
            return None
        json_config = json.loads(config)
        instance = cls(**json_config)
        return instance

    @staticmethod
    def extract_filename_from_url(url):
        """
        从URL中提取文件名
        参数:
            url (str): 要解析的URL
        返回:
            str: 提取出的文件名（不含查询参数）
        """
        # 解析URL
        parsed = urlparse(url)
        # 获取路径部分
        path = parsed.path
        # 获取路径中的最后一部分作为文件名
        filename = os.path.basename(path)
        return filename

    def upload_file_bytes(self, img_bytes, remote_path):
        try:
            remote_path = f"{self.remote_dir}/{remote_path}"
            display_return_path = remote_path
            if self.display_host:
                display_return_path = f"{self.display_host}/{remote_path}"
            self.bucket.put_object(remote_path, img_bytes)
            return display_return_path
        except Exception as e:
            raise Exception(f"upload file error, e: {e}")


def trans_url(old_url, oss_config=None):
    """
    将外部URL图片转存至OSS，返回永久URL
    :param old_url: 原始图片URL
    :param oss_config: OSS配置JSON字符串，若为None则使用默认配置
    :return: 转存后的图片URL
    """
    if oss_config is None:
        oss_config = DEFAULT_OSS_CONFIG

    oss_client = BucketCommand.from_str_config(oss_config)
    if oss_client is None:
        raise ValueError("OSS is not configured.")
    file_name = oss_client.extract_filename_from_url(old_url)
    ext = str(os.path.splitext(file_name)[1]).lstrip('.')
    response = requests.get(old_url, stream=True)
    response.raise_for_status()  # 确保请求成功

    file_path = f"dify_upload_{int(time.time())}_{uuid.uuid4()}.{ext}"
    new_url = oss_client.upload_file_bytes(response.content, file_path)
    return new_url


def upload_local_image(local_file_path, oss_config=None):
    """
    上传本地图片文件到OSS，返回永久URL
    :param local_file_path: 本地图片文件路径
    :param oss_config: OSS配置JSON字符串，若为None则使用默认配置
    :return: 图片的永久URL
    """
    if oss_config is None:
        oss_config = DEFAULT_OSS_CONFIG

    oss_client = BucketCommand.from_str_config(oss_config)
    if oss_client is None:
        raise ValueError("OSS is not configured.")

    # 获取文件扩展名
    _, ext = os.path.splitext(local_file_path)
    ext = ext.lstrip('.')  # 去掉点号
    if not ext:
        # 若无法获取扩展名，可默认设为 png 或抛出异常
        ext = 'png'

    # 生成唯一的远程文件名
    remote_filename = f"dify_upload_{int(time.time())}_{uuid.uuid4()}.{ext}"

    # 读取本地文件二进制内容
    with open(local_file_path, 'rb') as f:
        file_bytes = f.read()

    # 上传并返回URL
    new_url = oss_client.upload_file_bytes(file_bytes, remote_filename)
    return new_url


if __name__ == '__main__':
    # 示例：上传本地图片
    local_url = upload_local_image("/path/to/your/local/image.jpg")
    print(local_url)

    # 示例：转存外部URL图片（可选）
    # remote_url = trans_url("https://example.com/some_image.png")
    # print(remote_url)
