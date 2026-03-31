"""
测试配置和共享 fixtures
"""

import asyncio
import pytest


@pytest.fixture(scope="session")
def event_loop():
    """为整个测试会话创建一个事件循环"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
